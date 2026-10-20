import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import type { RecentPost } from '@/lib/platforms/types';
import { instagramAccess } from './instagram-access';

/** Últimas publicações do Instagram ativo da marca (null se a marca não tiver Instagram ligado). */
export async function instagramRecentPosts(db: SupabaseClient, brandId: string): Promise<RecentPost[] | null> {
  const { data: acc } = await db
    .from('social_accounts')
    .select('id')
    .eq('brand_id', brandId)
    .eq('platform', 'instagram')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!acc) return null;
  const a = await instagramAccess(db, acc.id);
  if (!a) return null;
  return getAdapters(serverEnv()).instagram.listRecentPosts(a, new Date(0), { fetch });
}
