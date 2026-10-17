import type { SupabaseClient } from '@supabase/supabase-js';
import { fromMediaRow, type MediaAsset } from '@/lib/db/types';

export interface MediaItem extends MediaAsset {
  previewUrl: string | null;
}

/** Lista mídia (opcionalmente filtrada) com links assinados para pré-visualização. */
export async function listMedia(
  db: SupabaseClient,
  opts: { brandId?: string | null; kind?: 'image' | 'video' | null; tag?: string | null; ids?: string[]; limit?: number; folderId?: string | 'none' | null; oldestFirst?: boolean } = {},
): Promise<MediaItem[]> {
  let q = db.from('media_assets').select('*').order('created_at', { ascending: !!opts.oldestFirst }).limit(opts.limit ?? 200);
  if (opts.brandId) q = q.eq('brand_id', opts.brandId);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.tag) q = q.contains('tags', [opts.tag]);
  if (opts.ids) q = q.in('id', opts.ids);
  if (opts.folderId === 'none') q = q.is('folder_id', null);
  else if (opts.folderId) q = q.eq('folder_id', opts.folderId);
  const { data, error } = await q;
  if (error) throw new Error(`media_assets: ${error.message}`);
  const items = (data ?? []).map(fromMediaRow);
  const paths = items.map((m) => m.thumbnailPath ?? (m.kind === 'image' ? m.storagePath : null)).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from('media').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return items.map((m) => ({ ...m, previewUrl: urls.get(m.thumbnailPath ?? m.storagePath) ?? null }));
}
