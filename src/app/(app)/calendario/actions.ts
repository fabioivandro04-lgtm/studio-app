'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/clients';
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
