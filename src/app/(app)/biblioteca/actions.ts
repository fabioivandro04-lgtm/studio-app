'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/clients';
import type { ActionResult } from '../definicoes/actions';

export async function tagMedia(id: string, tags: string[]): Promise<ActionResult> {
  const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  const db = await createServerClient();
  const { error } = await db.from('media_assets').update({ tags: clean }).eq('id', id);
  if (error) return { ok: false, error: 'Não foi possível guardar as etiquetas.' };
  revalidatePath('/biblioteca');
  return { ok: true };
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const db = await createServerClient();
  const { data: media } = await db.from('media_assets').select('storage_path, thumbnail_path').eq('id', id).single();
  if (!media) return { ok: false, error: 'Ficheiro não encontrado.' };
  const { error } = await db.from('media_assets').delete().eq('id', id);
  if (error) {
    return {
      ok: false,
      error: error.code === '23503' ? 'Esta mídia está num post. Remova-a do post primeiro.' : 'Não foi possível apagar o ficheiro.',
    };
  }
  await db.storage.from('media').remove([media.storage_path, ...(media.thumbnail_path ? [media.thumbnail_path] : [])]);
  revalidatePath('/biblioteca');
  return { ok: true };
}

/** Link temporário (1 h) para ver o ficheiro original (foto ou vídeo). */
export async function mediaFileUrl(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Ficheiro não encontrado.' };
  const db = await createServerClient();
  const { data: media } = await db.from('media_assets').select('storage_path').eq('id', id).maybeSingle();
  if (!media) return { ok: false, error: 'Ficheiro não encontrado.' };
  const { data, error } = await db.storage.from('media').createSignedUrl(media.storage_path, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: 'Não foi possível abrir o ficheiro.' };
  return { ok: true, url: data.signedUrl };
}
