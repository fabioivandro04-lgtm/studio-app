'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/clients';
import type { PostStatus, TargetStatus } from '@/lib/platforms/types';
import { canRemoveFromCalendar } from '@/lib/posts/delete-rules';
import { localToUtc, utcToLocalParts } from '@/lib/time/zone';

export async function reschedule(postId: string, newDate: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { ok: false, error: 'Data inválida.' };
  const db = await createServerClient();
  const { data: post } = await db.from('posts').select('id, status, scheduled_at, brands(timezone)').eq('id', postId).single();
  if (!post || !post.scheduled_at) return { ok: false, error: 'Post não encontrado.' };
  if (!['draft', 'scheduled'].includes(post.status)) return { ok: false, error: 'Este post já começou a publicar.' };
  const { count } = await db.from('post_targets').select('id', { count: 'exact', head: true }).eq('post_id', postId).neq('status', 'pending');
  if ((count ?? 0) > 0) return { ok: false, error: 'Este post já começou a publicar.' };

  const tz = (post.brands as unknown as { timezone: string } | null)?.timezone ?? 'Africa/Maputo';
  const { time } = utcToLocalParts(new Date(post.scheduled_at), tz);
  const at = localToUtc(newDate, time, tz);
  if (post.status === 'scheduled' && at <= new Date()) return { ok: false, error: 'A data já passou.' };
  const { error } = await db.from('posts').update({ scheduled_at: at.toISOString(), updated_at: new Date().toISOString() }).eq('id', postId);
  if (error) return { ok: false, error: 'Não foi possível reagendar.' };
  revalidatePath('/calendario');
  return { ok: true };
}

/** Apaga do Estúdio os posts escolhidos no calendário (um ou vários). Os agendados são cancelados antes; os que estão a publicar ficam. */
export async function deletePosts(ids: string[]): Promise<{ ok: true; removed: number; skipped: number } | { ok: false; error: string }> {
  const valid = z.array(z.guid()).min(1).max(500).safeParse(ids);
  if (!valid.success) return { ok: false, error: 'Escolha pelo menos um post.' };
  const db = await createServerClient();
  const { data, error } = await db.from('posts').select('id, status, post_targets(status)').in('id', valid.data);
  if (error) return { ok: false, error: 'Não foi possível ler os posts.' };
  const rows = (data ?? []).filter((r) => canRemoveFromCalendar(r.status as PostStatus, (r.post_targets ?? []).map((t: { status: TargetStatus }) => t.status)));
  for (const r of rows.filter((x) => x.status === 'scheduled')) {
    const { error: e } = await db.rpc('cancel_post', { p_id: r.id });
    if (e) return { ok: false, error: 'Não foi possível cancelar um post agendado.' };
  }
  let removed = 0;
  if (rows.length) {
    // Um agendado que começou a publicar entretanto já não está "cancelled" e fica.
    const { data: gone, error: e } = await db.from('posts').delete().in('id', rows.map((r) => r.id)).neq('status', 'scheduled').neq('status', 'publishing').neq('status', 'needs_action').select('id');
    if (e) return { ok: false, error: 'Não foi possível apagar os posts.' };
    removed = gone?.length ?? 0;
  }
  revalidatePath('/calendario');
  revalidatePath('/caixa');
  revalidatePath('/metricas');
  return { ok: true, removed, skipped: valid.data.length - removed };
}
