import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { createTickRepo } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import { ensureFreshToken } from '@/lib/publishing/tokens';

export interface InstagramAccess {
  id: string;
  externalId: string;
  handle: string;
  accessToken: string;
}

/**
 * Token válido de uma conta de Instagram ativa (null se não existir).
 * O cliente do dono (RLS) confirma que a conta é dele; só depois se lê o token com o cliente de serviço.
 */
export async function instagramAccess(db: SupabaseClient, accountId: string): Promise<InstagramAccess | null> {
  const { data: acc } = await db
    .from('social_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('platform', 'instagram')
    .eq('status', 'active')
    .maybeSingle();
  if (!acc) return null;
  const env = serverEnv();
  const svc = createServiceClient();
  const { data: a } = await svc
    .from('social_accounts')
    .select('id, external_id, handle, access_token_enc, refresh_token_enc, token_expires_at')
    .eq('id', acc.id)
    .single();
  if (!a) return null;
  const accessToken = await ensureFreshToken(
    { id: a.id, externalId: a.external_id, accessTokenEnc: a.access_token_enc, refreshTokenEnc: a.refresh_token_enc, tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null },
    getAdapters(env).instagram,
    { repo: createTickRepo(svc, env.TOKEN_ENC_KEY), decrypt: (x) => decryptToken(x, env.TOKEN_ENC_KEY), fetch, now: () => new Date() },
  );
  return { id: a.id, externalId: a.external_id, handle: a.handle, accessToken };
}
