'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/clients';
import type { PostStatus, TargetStatus } from '@/lib/platforms/types';
import { pickClearable } from '@/lib/posts/clear-rules';
import { localToUtc } from '@/lib/time/zone';

const Input = z.object({ brandId: z.guid(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

type Found = { ok: true; drafts: number; scheduled: number; cancelled: number; ids: { cancel: string[]; remove: string[] } } | { ok: false; error: string };

async function find(raw: { brandId: string; from: string }): Promise<Found> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: 'Escolha a marca e a data.' };
  const db = await createServerClient();
  const { data: brand } = await db.from('brands').select('timezone').eq('id', p.data.brandId).maybeSingle();
  if (!brand) return { ok: false, error: 'Marca não encontrada.' };
  const { data, error } = await db
    .from('posts')
    .select('id, status, post_targets(status)')
    .eq('brand_id', p.data.brandId)
    .in('status', ['draft', 'scheduled', 'cancelled'])
    .gte('scheduled_at', localToUtc(p.data.from, '00:00', brand.timezone).toISOString());
  if (error) return { ok: false, error: 'Não foi possível ler o calendário.' };
  const rows = (data ?? []).map((r) => ({ id: r.id as string, status: r.status as PostStatus, targets: (r.post_targets ?? []).map((t: { status: TargetStatus }) => t.status) }));
  const ids = pickClearable(rows);
  const kept = new Set(ids.remove);
  const count = (s: PostStatus) => rows.filter((r) => kept.has(r.id) && r.status === s).length;
  return { ok: true, drafts: count('draft'), scheduled: count('scheduled'), cancelled: count('cancelled'), ids };
}

/** Conta o que a limpeza apagaria, sem mexer em nada. */
export async function previewClear(raw: { brandId: string; from: string }) {
  const r = await find(raw);
  return r.ok ? { ok: true as const, drafts: r.drafts, scheduled: r.scheduled, cancelled: r.cancelled } : r;
}

/** Cancela os agendados e apaga do Estúdio tudo o que não foi publicado a partir da data. Não mexe nas redes sociais. */
export async function clearCalendar(raw: { brandId: string; from: string }): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const r = await find(raw);
  if (!r.ok) return r;
  const db = await createServerClient();
  for (const id of r.ids.cancel) {
    const { error } = await db.rpc('cancel_post', { p_id: id });
    if (error) return { ok: false, error: 'Não foi possível cancelar um post agendado.' };
  }
  let removed = 0;
  if (r.ids.remove.length) {
    // Só apaga o que ficou parado (rascunho ou cancelado): um agendado que começou a publicar entretanto fica.
    const { data, error } = await db.from('posts').delete().in('id', r.ids.remove).in('status', ['draft', 'cancelled']).select('id');
    if (error) return { ok: false, error: 'Não foi possível apagar os posts.' };
    removed = data?.length ?? 0;
  }
  revalidatePath('/calendario');
  revalidatePath('/caixa');
  revalidatePath('/pendentes');
  revalidatePath('/metricas');
  return { ok: true, removed };
}
