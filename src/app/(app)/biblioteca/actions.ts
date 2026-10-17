'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/clients';
import { listMedia, type MediaItem } from '@/lib/db/repo/media-repo';
import { listFolderOptions } from '@/lib/db/repo/folders-repo';
import * as folders from '@/lib/library/folders';
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
  if (!UUID.test(id)) return { ok: false, error: 'Ficheiro não encontrado.' };
  const db = await createServerClient();
  const { data: media } = await db.from('media_assets').select('storage_path').eq('id', id).maybeSingle();
  if (!media) return { ok: false, error: 'Ficheiro não encontrado.' };
  const { data, error } = await db.storage.from('media').createSignedUrl(media.storage_path, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: 'Não foi possível abrir o ficheiro.' };
  return { ok: true, url: data.signedUrl };
}

/** Biblioteca de uma marca para o editor de posts (carregada só quando se abre "Escolher ficheiros"). */
export async function listBrandMedia(
  brandId: string,
): Promise<{ ok: true; items: MediaItem[]; folders: { id: string; name: string }[] } | { ok: false; error: string }> {
  if (!UUID.test(brandId)) return { ok: false, error: 'Marca não encontrada.' };
  try {
    const db = await createServerClient();
    const [items, opts] = await Promise.all([listMedia(db, { brandId, limit: 300 }), listFolderOptions(db, brandId)]);
    return { ok: true, items, folders: opts };
  } catch {
    return { ok: false, error: 'Não foi possível abrir a biblioteca.' };
  }
}

const UUID = /^[0-9a-f-]{36}$/i;
const done = <T extends { ok: boolean }>(r: T): T => {
  if (r.ok) revalidatePath('/biblioteca');
  return r;
};
const bad = { ok: false as const, error: 'Pedido inválido.' };

export async function createFolder(input: { brandId: string; name: string; notes?: string }) {
  if (!UUID.test(input.brandId)) return bad;
  return done(await folders.createFolder(await createServerClient(), input));
}

export async function ensureFolder(input: { brandId: string; name: string }) {
  if (!UUID.test(input.brandId)) return bad;
  return done(await folders.ensureFolder(await createServerClient(), input));
}

export async function updateFolder(input: { id: string; name?: string; notes?: string }) {
  if (!UUID.test(input.id)) return bad;
  return done(await folders.updateFolder(await createServerClient(), input));
}

export async function deleteFolder(id: string) {
  if (!UUID.test(id)) return bad;
  return done(await folders.deleteFolder(await createServerClient(), id));
}

export async function moveMedia(input: { ids: string[]; folderId: string | null }) {
  if (!Array.isArray(input.ids) || input.ids.length > 300 || !input.ids.every((i) => UUID.test(i))) return bad;
  if (input.folderId !== null && !UUID.test(input.folderId)) return bad;
  return done(await folders.moveMedia(await createServerClient(), input));
}
