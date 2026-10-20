import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { serverEnv } from '@/lib/env';
import { getAdsClient } from './registry';
import type { AdInsights, AdsConnection } from './types';

export interface AdAccountRow {
  id: string;
  brandId: string;
  externalId: string;
  name: string;
  currency: string;
  tokenExpiresAt: Date | null;
}

/** Contas de anúncios das marcas (cliente do dono, RLS; sem tokens). */
export async function listAdAccounts(db: SupabaseClient, brandId: string | null): Promise<AdAccountRow[]> {
  let q = db.from('ad_accounts').select('id, brand_id, external_id, name, currency, token_expires_at');
  if (brandId) q = q.eq('brand_id', brandId);
  const { data } = await q.order('name');
  return (data ?? []).map((a) => ({
    id: a.id, brandId: a.brand_id, externalId: a.external_id, name: a.name, currency: a.currency,
    tokenExpiresAt: a.token_expires_at ? new Date(a.token_expires_at) : null,
  }));
}

/** Guarda as contas de anúncios devolvidas pelo login (cliente de serviço — escreve o token encriptado). */
export async function saveAdAccounts(db: SupabaseClient, tokenKey: string, brandId: string, conn: AdsConnection): Promise<void> {
  if (conn.accounts.length === 0) return;
  const enc = encryptToken(conn.accessToken, tokenKey);
  const { error } = await db.from('ad_accounts').upsert(
    conn.accounts.map((a) => ({
      brand_id: brandId, external_id: a.externalId, name: a.name, currency: a.currency,
      access_token_enc: enc, token_expires_at: conn.expiresAt?.toISOString() ?? null,
    })),
    { onConflict: 'brand_id,external_id' },
  );
  if (error) throw new Error(`saveAdAccounts: ${error.message}`);
}

export type InsightsResult = { ok: true; insights: AdInsights } | { ok: false; error: string };

/** Resultados de uma conta de anúncios no período. O cliente do dono confirma a conta antes de ler o token. */
export async function loadAdInsights(db: SupabaseClient, accountId: string, since: string, until: string): Promise<InsightsResult> {
  const { data: own } = await db.from('ad_accounts').select('id').eq('id', accountId).maybeSingle();
  if (!own) return { ok: false, error: 'Conta de anúncios não encontrada.' };
  const env = serverEnv();
  const { data: a } = await createServiceClient().from('ad_accounts').select('external_id, access_token_enc').eq('id', accountId).single();
  if (!a) return { ok: false, error: 'Conta de anúncios não encontrada.' };
  try {
    const token = decryptToken(a.access_token_enc, env.TOKEN_ENC_KEY);
    return { ok: true, insights: await getAdsClient(env).insights(token, a.external_id, since, until, { fetch }) };
  } catch (e) {
    return { ok: false, error: (e as { userMessage?: string }).userMessage ?? 'Não foi possível ler os resultados dos anúncios.' };
  }
}
