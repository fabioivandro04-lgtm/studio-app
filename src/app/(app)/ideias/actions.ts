'use server';

import { revalidatePath } from 'next/cache';
import { suggestSlots } from '@/lib/ai/best-time';
import { aiSetup, fail, toBrandAi, type Fail } from '@/lib/ai/context';
import { AiError } from '@/lib/ai/errors';
import type { IdeasMode } from '@/lib/ai/ideas-prompts';
import { deadlineDates, IDEAS_PER_RUN, missingForWeek, nextWeekRange, timeForDate, weekPlanDays } from '@/lib/ai/plan-dates';
import { runIdeas } from '@/lib/ai/service';
import { createServerClient } from '@/lib/db/clients';
import { bestTimeInputs } from '@/lib/db/repo/ai-repo';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { claimIdea, getIdea, insertIdeas, linkIdeaPost, plannedCount, recentTitles, setIdeaStatus, upcomingDeadlines, type IdeaKind } from '@/lib/db/repo/ideas-repo';
import type { Brand } from '@/lib/db/types';
import { DeadlineInput, draftPayload, GenerateInput, IdeaIdInput, IdeaStatusInput } from '@/lib/ideas/draft';
import type { Platform } from '@/lib/platforms/types';
import { localToUtc, utcToLocalParts } from '@/lib/time/zone';
import type { SupabaseClient } from '@supabase/supabase-js';

type Ok = { ok: true; count: number };
const ALL_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube'];
const DEADLINES_AHEAD_DAYS = 42;

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? 'Pedido inválido.';
const addDaysIso = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function activePlatforms(db: SupabaseClient, brandId: string): Promise<Platform[]> {
  const { data } = await db.from('social_accounts').select('platform').eq('brand_id', brandId).eq('status', 'active');
  const list = [...new Set((data ?? []).map((a) => a.platform as Platform))];
  return list.length ? list : ALL_PLATFORMS;
}

/** Datas (com hora) para cada dia, evitando posts agendados e as horas já atribuídas neste lote. */
async function scheduleDays(db: SupabaseClient, brand: Brand, days: string[], now: Date): Promise<Date[]> {
  const { history, busy } = await bestTimeInputs(db, brand.id, null, now);
  const taken = [...busy];
  return days.map((date) => {
    const at = localToUtc(date, timeForDate({ date, goal: brand.goal, tz: brand.timezone, history, busy: taken, now }), brand.timezone);
    taken.push(at);
    return at;
  });
}

async function generate(o: {
  brandId: string;
  kind: IdeaKind;
  mode: IdeasMode;
  plan: (ctx: { db: SupabaseClient; brand: Brand; now: Date }) => Promise<{
    count: number;
    dates: Date[] | null;
    deadline: { id: string; title: string; dueDate: string; institution: string | null; country: string | null } | null;
  }>;
}): Promise<Ok | Fail> {
  try {
    const { db, brand, deps } = await aiSetup(o.brandId);
    const now = new Date();
    const plan = await o.plan({ db, brand, now });
    const today = utcToLocalParts(now, brand.timezone).date;
    const [platforms, titles, upcoming] = await Promise.all([
      activePlatforms(db, brand.id),
      recentTitles(db, brand.id),
      upcomingDeadlines(db, brand.id, today, addDaysIso(today, DEADLINES_AHEAD_DAYS)),
    ]);
    const ideas = await runIdeas(deps, {
      brandId: brand.id, brand: toBrandAi(brand), mode: o.mode, count: plan.count,
      deadline: plan.deadline, upcomingDeadlines: upcoming.map(({ title, dueDate }) => ({ title, dueDate })), recentTitles: titles, platforms,
    });
    await insertIdeas(db, ideas.map((idea, i) => ({ brandId: brand.id, kind: o.kind, deadlineId: plan.deadline?.id ?? null, suggestedAt: plan.dates?.[i] ?? null, idea })));
    revalidatePath('/ideias');
    return { ok: true, count: ideas.length };
  } catch (e) {
    return fail(e);
  }
}

export async function generateShortsIdeas(i: { brandId: string }): Promise<Ok | Fail> {
  const parsed = GenerateInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return generate({ brandId: i.brandId, kind: 'shorts', mode: 'shorts', plan: async () => ({ count: IDEAS_PER_RUN, dates: null, deadline: null }) });
}

export async function generateDeadlineIdeas(i: { brandId: string; deadlineId: string }): Promise<Ok | Fail> {
  const parsed = DeadlineInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return generate({
    brandId: i.brandId, kind: 'deadline', mode: 'deadline',
    plan: async ({ db, brand, now }) => {
      const { data: d } = await db.from('deadlines').select('id, title, due_date, institution, country').eq('id', i.deadlineId).eq('brand_id', brand.id).maybeSingle();
      if (!d) throw new AiError('invalid_input', 'Prazo não encontrado.');
      const dueDate = String(d.due_date).slice(0, 10);
      const days = deadlineDates(dueDate, utcToLocalParts(now, brand.timezone).date);
      if (days.length === 0) throw new AiError('invalid_input', 'Este prazo já passou.');
      return {
        count: days.length,
        dates: await scheduleDays(db, brand, days, now),
        deadline: { id: d.id, title: d.title, dueDate, institution: d.institution, country: d.country },
      };
    },
  });
}

export async function planNextWeek(i: { brandId: string }): Promise<Ok | Fail> {
  const parsed = GenerateInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return generate({
    brandId: i.brandId, kind: 'week', mode: 'week',
    plan: async ({ db, brand, now }) => {
      const { start, end } = nextWeekRange(now, brand.timezone);
      const from = localToUtc(start, '00:00', brand.timezone);
      const to = localToUtc(addDaysIso(end, 1), '00:00', brand.timezone);
      const missing = missingForWeek(brand.postsPerWeek, await plannedCount(db, brand.id, from, to));
      if (missing === 0) throw new AiError('invalid_input', 'A próxima semana já está completa.');
      const days = weekPlanDays(start, missing);
      return { count: days.length, dates: await scheduleDays(db, brand, days, now), deadline: null };
    },
  });
}

/** Cria um rascunho no calendário a partir da ideia e devolve o id do post. */
export async function ideaToDraft(i: { ideaId: string }): Promise<{ ok: true; postId: string } | Fail> {
  const parsed = IdeaIdInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const db = await createServerClient();
    const idea = await getIdea(db, i.ideaId);
    if (!idea) return { ok: false, error: 'Ideia não encontrada.' };
    if (idea.status === 'used' && idea.postId) return { ok: true, postId: idea.postId };
    if (idea.status !== 'new') return { ok: false, error: 'Recupere a ideia antes de a pôr no calendário.' };
    const brand = (await listBrands(db)).find((b) => b.id === idea.brandId);
    if (!brand) return { ok: false, error: 'Marca não encontrada.' };
    const now = new Date();
    let at = idea.suggestedAt && idea.suggestedAt.getTime() > now.getTime() + 3_600_000 ? idea.suggestedAt : null;
    if (!at) {
      const { history, busy } = await bestTimeInputs(db, brand.id, null, now);
      const slot = suggestSlots({ history, goal: brand.goal, tz: brand.timezone, busy, now })[0];
      at = slot ? localToUtc(slot.date, slot.time, brand.timezone) : new Date(now.getTime() + 86_400_000);
    }
    const { data: accounts } = await db.from('social_accounts').select('id, platform, status').eq('brand_id', brand.id);
    const payload = draftPayload({ brandId: brand.id, idea, scheduledAt: at, accounts: (accounts ?? []) as { id: string; platform: Platform; status: string }[] });
    if (!(await claimIdea(db, idea.id))) {
      // Outro clique ou separador chegou primeiro: abrir o post dele, se já existir.
      const again = await getIdea(db, idea.id);
      return again?.postId ? { ok: true, postId: again.postId } : { ok: false, error: 'Esta ideia já está a ser posta no calendário.' };
    }
    const { data: postId, error } = await db.rpc('save_post', { p: payload });
    if (error || !postId) {
      await setIdeaStatus(db, idea.id, 'new');
      return { ok: false, error: 'Não foi possível criar o rascunho.' };
    }
    await linkIdeaPost(db, idea.id, postId as string);
    revalidatePath('/ideias');
    revalidatePath('/calendario');
    return { ok: true, postId: postId as string };
  } catch (e) {
    return fail(e);
  }
}

export async function changeIdeaStatus(i: { ideaId: string; status: 'new' | 'discarded' }): Promise<{ ok: true } | Fail> {
  const parsed = IdeaStatusInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const db = await createServerClient();
    if (!(await setIdeaStatus(db, i.ideaId, i.status))) return { ok: false, error: 'Ideia não encontrada.' };
    revalidatePath('/ideias');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
