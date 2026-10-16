'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadDrafts } from '@/lib/caixa/drafts-repo';
import { planSchedule } from '@/lib/caixa/schedule';
import { createServerClient } from '@/lib/db/clients';

export type ScheduleResult = { ok: true; scheduled: string[]; skipped: { id: string; reason: string }[] } | { ok: false; error: string };

/** Agenda os rascunhos escolhidos que passam nas regras; os outros ficam de fora com o motivo. */
export async function scheduleDrafts(ids: string[]): Promise<ScheduleResult> {
  const parsed = z.array(z.guid()).min(1).max(50).safeParse(ids);
  if (!parsed.success) return { ok: false, error: 'Escolha pelo menos um rascunho.' };
  const db = await createServerClient();
  const { candidates } = await loadDrafts(db, { ids: [...new Set(parsed.data)] });
  const plan = planSchedule(candidates, new Date());
  const scheduled: string[] = [];
  const skipped = [...plan.skipped];
  for (const r of plan.ready) {
    const c = candidates.find((x) => x.id === r.id);
    if (!c || c.missing) continue;
    const { error } = await db.rpc('save_post', { p: { ...c.input, intent: 'schedule', scheduledAt: r.scheduledAt.toISOString() } });
    if (error) skipped.push({ id: r.id, reason: error.message.includes('post_locked') ? 'Já não é um rascunho.' : 'Não foi possível agendar.' });
    else scheduled.push(r.id);
  }
  if (scheduled.length) {
    revalidatePath('/caixa');
    revalidatePath('/calendario');
  }
  return { ok: true, scheduled, skipped };
}
