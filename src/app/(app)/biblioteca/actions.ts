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
