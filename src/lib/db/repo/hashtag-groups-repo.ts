import type { SupabaseClient } from '@supabase/supabase-js';

export interface HashtagGroup { id: string; brandId: string; name: string; tags: string[] }

/** Grupos de hashtags (de uma marca, ou de todas), por nome. */
export async function listHashtagGroups(db: SupabaseClient, brandId?: string): Promise<HashtagGroup[]> {
  let q = db.from('hashtag_groups').select('id, brand_id, name, tags').order('name');
  if (brandId) q = q.eq('brand_id', brandId);
  const { data, error } = await q;
  if (error) throw new Error(`hashtag_groups: ${error.message}`);
  return (data ?? []).map((g) => ({ id: g.id, brandId: g.brand_id, name: g.name, tags: g.tags ?? [] }));
}
