import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanFolderName } from './folder-name';

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOTES_MAX = 2000;
const BAD_NAME = 'O nome tem de ter entre 1 e 80 caracteres.';
const BAD_NOTES = 'A nota pode ter até 2000 caracteres.';
const DUPLICATE = 'Já existe uma pasta com esse nome.';

// Compara no servidor da app: no ilike do PostgREST, % * _ seriam curingas.
async function findByName(db: SupabaseClient, brandId: string, name: string): Promise<string | null> {
  const { data } = await db.from('media_folders').select('id, name').eq('brand_id', brandId);
  const key = name.toLowerCase();
  return ((data ?? []).find((f) => String(f.name).toLowerCase() === key)?.id as string) ?? null;
}

export async function createFolder(db: SupabaseClient, o: { brandId: string; name: string; notes?: string }): Promise<Result<{ id: string }>> {
  const name = cleanFolderName(o.name);
  if (!name) return { ok: false, error: BAD_NAME };
  const notes = (o.notes ?? '').trim();
  if (notes.length > NOTES_MAX) return { ok: false, error: BAD_NOTES };
  if (await findByName(db, o.brandId, name)) return { ok: false, error: DUPLICATE };
  const { data, error } = await db.from('media_folders').insert({ brand_id: o.brandId, name, notes }).select('id').single();
  if (error || !data) return { ok: false, error: error?.code === '23505' ? DUPLICATE : 'Não foi possível criar a pasta.' };
  return { ok: true, id: data.id as string };
}

/** Pasta com este nome na marca: a existente (sem mexer na nota) ou uma nova com `notes`. */
export async function ensureFolder(db: SupabaseClient, o: { brandId: string; name: string; notes?: string }): Promise<Result<{ id: string; created: boolean }>> {
  const name = cleanFolderName(o.name);
  if (!name) return { ok: false, error: BAD_NAME };
  const existing = await findByName(db, o.brandId, name);
  if (existing) return { ok: true, id: existing, created: false };
  const r = await createFolder(db, { brandId: o.brandId, name, notes: o.notes });
  return r.ok ? { ok: true, id: r.id, created: true } : r;
}

export async function updateFolder(db: SupabaseClient, o: { id: string; name?: string; notes?: string }): Promise<Result> {
  const patch: Record<string, string> = {};
  if (o.name !== undefined) {
    const name = cleanFolderName(o.name);
    if (!name) return { ok: false, error: BAD_NAME };
    patch.name = name;
  }
  if (o.notes !== undefined) {
    if (o.notes.trim().length > NOTES_MAX) return { ok: false, error: BAD_NOTES };
    patch.notes = o.notes.trim();
  }
  const { data, error } = await db.from('media_folders').update(patch).eq('id', o.id).select('id');
  if (error) return { ok: false, error: error.code === '23505' ? DUPLICATE : 'Não foi possível guardar a pasta.' };
  if (!data?.length) return { ok: false, error: 'Pasta não encontrada.' };
  return { ok: true };
}

/** Apaga só a pasta; os ficheiros ficam "Sem pasta" (on delete set null). */
export async function deleteFolder(db: SupabaseClient, id: string): Promise<Result> {
  const { error } = await db.from('media_folders').delete().eq('id', id);
  return error ? { ok: false, error: 'Não foi possível apagar a pasta.' } : { ok: true };
}

/** Põe os ficheiros numa pasta (ou tira, com folderId null). Todos da mesma marca da pasta. */
export async function moveMedia(db: SupabaseClient, o: { ids: string[]; folderId: string | null }): Promise<Result<{ moved: number }>> {
  const ids = [...new Set(o.ids)];
  if (!ids.length) return { ok: false, error: 'Escolha pelo menos um ficheiro.' };
  const { data: media } = await db.from('media_assets').select('id, brand_id').in('id', ids);
  if (!media || media.length !== ids.length) return { ok: false, error: 'Ficheiro não encontrado.' };
  const brands = new Set(media.map((m) => m.brand_id as string));
  if (brands.size > 1) return { ok: false, error: 'Escolha ficheiros de uma só marca.' };
  if (o.folderId) {
    const { data: folder } = await db.from('media_folders').select('id, brand_id').eq('id', o.folderId).maybeSingle();
    if (!folder) return { ok: false, error: 'Pasta não encontrada.' };
    if (!brands.has(folder.brand_id as string)) return { ok: false, error: 'A pasta é de outra marca.' };
  }
  const { error } = await db.from('media_assets').update({ folder_id: o.folderId }).in('id', ids);
  if (error) return { ok: false, error: 'Não foi possível mover os ficheiros.' };
  return { ok: true, moved: ids.length };
}
