import type { SupabaseClient } from '@supabase/supabase-js';
import { fromPostMediaRows, usageOf, type MediaUsage, type UsageRow } from '@/lib/library/usage';

export interface Folder { id: string; brandId: string; name: string; notes: string; createdAt: Date }
export interface FolderCard extends Folder { count: number; usedIn: number; previews: string[] }

const fromFolderRow = (r: Record<string, unknown>): Folder => ({
  id: r.id as string, brandId: r.brand_id as string, name: r.name as string, notes: (r.notes as string) ?? '',
  createdAt: new Date(r.created_at as string),
});

const BATCH = 100; // ids por pedido: mantém o URL do PostgREST curto

/** Onde cada ficheiro foi usado (posts não cancelados). */
export async function mediaUsage(db: SupabaseClient, mediaIds: string[]): Promise<Map<string, MediaUsage>> {
  const rows: UsageRow[] = [];
  for (let i = 0; i < mediaIds.length; i += BATCH) {
    const { data, error } = await db
      .from('post_media')
      .select('media_id, post_id, posts!inner(internal_title, status, scheduled_at)')
      .in('media_id', mediaIds.slice(i, i + BATCH));
    if (error) throw new Error(`post_media: ${error.message}`);
    rows.push(...fromPostMediaRows((data ?? []) as never));
  }
  return usageOf(rows);
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

/** Pastas (com contagem, uso e até 4 miniaturas, via media_folder_stats) e nº de ficheiros sem pasta. */
export async function listFolders(db: SupabaseClient, brandId: string | null): Promise<{ folders: FolderCard[]; looseCount: number }> {
  let fq = db.from('media_folders').select('*').order('name');
  let lq = db.from('media_assets').select('id', { count: 'exact', head: true }).is('folder_id', null);
  if (brandId) {
    fq = fq.eq('brand_id', brandId);
    lq = lq.eq('brand_id', brandId);
  }
  const [{ data: frows, error: fe }, { data: stats, error: se }, { count: loose }] = await Promise.all([
    fq, db.rpc('media_folder_stats', { p_brand: brandId }), lq,
  ]);
  if (fe) throw new Error(`media_folders: ${fe.message}`);
  if (se) throw new Error(`media_folder_stats: ${se.message}`);
  const byId = new Map(((stats ?? []) as { folder_id: string; files: number; used_in: number; previews: string[] }[]).map((r) => [r.folder_id, r]));
  const paths = [...byId.values()].flatMap((r) => r.previews ?? []);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await db.storage.from('media').createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const folders = (frows ?? []).map((r) => {
    const f = fromFolderRow(r);
    const st = byId.get(f.id);
    const previews = (st?.previews ?? []).map((p) => urls.get(p)).filter((u): u is string => !!u);
    return { ...f, count: st?.files ?? 0, usedIn: st?.used_in ?? 0, previews };
  });
  return { folders, looseCount: loose ?? 0 };
}
