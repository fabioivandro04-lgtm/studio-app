import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { createTickRepo } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import type { RecentPost } from '@/lib/platforms/types';
import { ensureFreshToken } from '@/lib/publishing/tokens';

/**
 * Últimas publicações do Instagram ativo da marca (null se a marca não tiver Instagram ligado).
 * O cliente do dono (RLS) confirma que a conta é dele; só depois se lê o token com o cliente de serviço.
 */
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
  const env = serverEnv();
  const svc = createServiceClient();
  const { data: a } = await svc.from('social_accounts').select('id, external_id, access_token_enc, refresh_token_enc, token_expires_at').eq('id', acc.id).single();
  if (!a) return null;
  const adapter = getAdapters(env).instagram;
  const accessToken = await ensureFreshToken(
    { id: a.id, externalId: a.external_id, accessTokenEnc: a.access_token_enc, refreshTokenEnc: a.refresh_token_enc, tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null },
    adapter,
    { repo: createTickRepo(svc, env.TOKEN_ENC_KEY), decrypt: (x) => decryptToken(x, env.TOKEN_ENC_KEY), fetch, now: () => new Date() },
  );
  return adapter.listRecentPosts({ id: a.id, externalId: a.external_id, accessToken }, new Date(0), { fetch });
}
