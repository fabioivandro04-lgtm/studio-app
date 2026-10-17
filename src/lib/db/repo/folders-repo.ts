import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostMediaRows, usageOf, type MediaUsage } from '@/lib/library/usage';

export interface Folder { id: string; brandId: string; name: string; notes: string; createdAt: Date }
export interface FolderCard extends Folder { count: number; usedIn: number; previews: string[] }

const fromFolderRow = (r: Record<string, unknown>): Folder => ({
  id: r.id as string, brandId: r.brand_id as string, name: r.name as string, notes: (r.notes as string) ?? '',
  createdAt: new Date(r.created_at as string),
});

/** Onde cada ficheiro foi usado (posts não cancelados). */
export async function mediaUsage(db: SupabaseClient, mediaIds: string[]): Promise<Map<string, MediaUsage>> {
  if (!mediaIds.length) return new Map();
  const { data, error } = await db
    .from('post_media')
    .select('media_id, post_id, posts!inner(internal_title, status, scheduled_at)')
    .in('media_id', mediaIds);
  if (error) throw new Error(`post_media: ${error.message}`);
  return usageOf(fromPostMediaRows((data ?? []) as never));
}

export async function getFolder(db: SupabaseClient, id: string): Promise<Folder | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from('media_folders').select('*').eq('id', id).maybeSingle();
  return data ? fromFolderRow(data) : null;
}

export async function listFolderOptions(db: SupabaseClient, brandId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from('media_folders').select('id, name').eq('brand_id', brandId).order('name');
  if (error) throw new Error(`media_folders: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}

/** Pastas (com contagem, uso e até 4 miniaturas) e nº de ficheiros sem pasta. */
export async function listFolders(db: SupabaseClient, brandId: string | null): Promise<{ folders: FolderCard[]; looseCount: number }> {
  let fq = db.from('media_folders').select('*').order('name');
  let mq = db.from('media_assets').select('id, folder_id, kind, storage_path, thumbnail_path, created_at').order('created_at').limit(2000);
  if (brandId) {
    fq = fq.eq('brand_id', brandId);
    mq = mq.eq('brand_id', brandId);
  }
  const [{ data: frows, error: fe }, { data: media, error: me }] = await Promise.all([fq, mq]);
  if (fe) throw new Error(`media_folders: ${fe.message}`);
  if (me) throw new Error(`media_assets: ${me.message}`);
  const rows = media ?? [];
  const inFolders = rows.filter((m) => m.folder_id);
  const usage = await mediaUsage(db, inFolders.map((m) => m.id as string));

  const previewPath = (m: (typeof rows)[number]) => (m.thumbnail_path as string | null) ?? (m.kind === 'image' ? (m.storage_path as string) : null);
  const byFolder = new Map<string, typeof rows>();
  for (const m of inFolders) byFolder.set(m.folder_id as string, [...(byFolder.get(m.folder_id as string) ?? []), m]);
  const paths = [...byFolder.values()].flatMap((ms) => ms.map(previewPath).filter((p): p is string => !!p).slice(0, 4));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from('media').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const folders = (frows ?? []).map((r) => {
    const f = fromFolderRow(r);
    const ms = byFolder.get(f.id) ?? [];
    const posts = new Set(ms.flatMap((m) => usage.get(m.id as string)?.posts.map((p) => p.postId) ?? []));
    const previews = ms.map(previewPath).filter((p): p is string => !!p).slice(0, 4).map((p) => urls.get(p)).filter((u): u is string => !!u);
    return { ...f, count: ms.length, usedIn: posts.size, previews };
  });
  return { folders, looseCount: rows.length - inFolders.length };
}
