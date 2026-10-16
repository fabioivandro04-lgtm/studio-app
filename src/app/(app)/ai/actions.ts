'use server';

import { revalidatePath } from 'next/cache';
import { suggestSlots, type Slot } from '@/lib/ai/best-time';
import { aiSetup, fail, toBrandAi, type Fail } from '@/lib/ai/context';
import { AiError } from '@/lib/ai/errors';
import { RefineInput, SuggestInput } from '@/lib/ai/inputs';
import { runDraftVoice, runRefine, runSuggest } from '@/lib/ai/service';
import type { RefineAction, Suggestions } from '@/lib/ai/types';
import { AiSettingsInput } from '@/lib/brands/schema';
import { createServerClient } from '@/lib/db/clients';
import { bestTimeInputs, busyTimes, loadAiSettings, monthSpend } from '@/lib/db/repo/ai-repo';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { instagramRecentPosts } from '@/lib/db/repo/instagram-recent';
import { serverEnv } from '@/lib/env';
import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { nextFreeSlot } from '@/lib/schedule/slots';

const IMAGE_URL_TTL_S = 600;

export async function suggestPost(i: {
  brandId: string;
  prompt: string;
  mediaId: string | null;
  platforms: Platform[];
  formats: Partial<Record<Platform, TargetFormat>>;
}): Promise<{ ok: true; suggestions: Suggestions } | Fail> {
  const parsed = SuggestInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pedido inválido.' };
  try {
    const { db, brand, deps } = await aiSetup(i.brandId);
    let imageUrl: string | null = null;
    if (i.mediaId) {
      const { data: m } = await db.from('media_assets').select('storage_path, thumbnail_path, kind').eq('id', i.mediaId).maybeSingle();
      const path = m ? (m.thumbnail_path ?? (m.kind === 'image' ? m.storage_path : null)) : null;
      if (path) {
        const { data } = await db.storage.from('media').createSignedUrl(path, IMAGE_URL_TTL_S);
        imageUrl = data?.signedUrl ?? null;
      }
    }
    const targets = i.platforms.map((platform) => ({ platform, format: i.formats[platform] ?? defaultFormatFor(platform) }));
    const suggestions = await runSuggest(deps, { brandId: brand.id, brand: toBrandAi(brand), prompt: i.prompt, imageUrl, targets });
    return { ok: true, suggestions };
  } catch (e) {
    return fail(e);
  }
}

const defaultFormatFor = (p: Platform): TargetFormat => (p === 'instagram' ? 'ig_image' : p === 'tiktok' ? 'tiktok_video' : 'yt_short');

export async function refineCaption(i: { brandId: string; platform: Platform; text: string; action: RefineAction }): Promise<{ ok: true; text: string } | Fail> {
  const parsed = RefineInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pedido inválido.' };
  try {
    const { brand, deps } = await aiSetup(i.brandId);
    return { ok: true, text: await runRefine(deps, { ...i, brand: toBrandAi(brand) }) };
  } catch (e) {
    return fail(e);
  }
}

export async function draftVoice(i: { brandId: string }): Promise<{ ok: true; voice: string } | Fail> {
  try {
    const { db, brand, deps } = await aiSetup(i.brandId);
    const posts = await instagramRecentPosts(db, brand.id);
    if (!posts) throw new AiError('invalid_input', 'Ligue o Instagram desta marca primeiro.');
    const captions = posts.map((p) => p.title ?? '').filter(Boolean).slice(0, 20);
    return { ok: true, voice: await runDraftVoice(deps, { brandId: brand.id, brand: toBrandAi(brand), captions }) };
  } catch (e) {
    return fail(e);
  }
}

export async function bestTimes(i: { brandId: string; excludePostId: string | null }): Promise<{ ok: true; slots: Slot[] } | Fail> {
  try {
    const db = await createServerClient();
    const brand = (await listBrands(db)).find((b) => b.id === i.brandId);
    if (!brand) return { ok: false, error: 'Marca não encontrada.' };
    const now = new Date();
    const { history, busy } = await bestTimeInputs(db, brand.id, i.excludePostId, now);
    return { ok: true, slots: suggestSlots({ history, goal: brand.goal, tz: brand.timezone, busy, now }) };
  } catch (e) {
    return fail(e);
  }
}

export async function aiStatus(): Promise<{ ok: true; hasKey: boolean; model: string; limitUsd: number; spentUsd: number; requests: number } | Fail> {
  try {
    const db = await createServerClient();
    const env = serverEnv();
    const [settings, spend] = await Promise.all([loadAiSettings(db), monthSpend(db, new Date())]);
    return {
      ok: true, hasKey: env.PLATFORM_MODE === 'fake' || !!env.OPENROUTER_API_KEY,
      model: settings.model, limitUsd: settings.limitUsd, spentUsd: spend.usd, requests: spend.requests,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAiSettings(i: { model: string; limitUsd: number }): Promise<{ ok: true } | Fail> {
  const parsed = AiSettingsInput.safeParse(i);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const db = await createServerClient();
  const { error } = await db
    .from('app_settings')
    .update({ ai_model: parsed.data.model, ai_monthly_limit_usd: parsed.data.limitUsd })
    .eq('id', true);
  if (error) return { ok: false, error: 'Não foi possível guardar as definições da IA.' };
  revalidatePath('/definicoes/ia');
  return { ok: true };
}

/** Próximo horário fixo livre da marca (até 4 semanas). */
export async function nextSlot(i: { brandId: string; excludePostId: string | null }): Promise<{ ok: true; slot: { date: string; time: string } | null } | Fail> {
  try {
    const db = await createServerClient();
    const brand = (await listBrands(db)).find((b) => b.id === i.brandId);
    if (!brand) return { ok: false, error: 'Marca não encontrada.' };
    const now = new Date();
    const busy = await busyTimes(db, brand.id, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + 30 * 86_400_000), { excludePostId: i.excludePostId });
    return { ok: true, slot: nextFreeSlot({ slots: brand.postingSlots, tz: brand.timezone, busy, now }) };
  } catch (e) {
    return fail(e);
  }
}
