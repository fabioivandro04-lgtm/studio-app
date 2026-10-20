import { NextResponse, type NextRequest } from 'next/server';
import { getAdsClient } from '@/lib/ads/registry';
import { saveAdAccounts } from '@/lib/ads/repo';
import { createServiceClient } from '@/lib/db/clients';
import { serverEnv } from '@/lib/env';
import { readOAuthState } from '@/lib/oauth/state';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`/definicoes/contas?${query}`, request.url));
    res.cookies.delete('oauth_state');
    return res;
  };
  const fail = (msg: string) => done(`erro=${encodeURIComponent(msg)}`);

  const env = serverEnv();
  const stateParam = q.get('state') ?? '';
  const cookie = request.cookies.get('oauth_state')?.value ?? '';
  const state = stateParam && stateParam === cookie ? readOAuthState(stateParam, env.TOKEN_ENC_KEY) : null;
  if (!state || state.platform !== 'meta_ads') return fail('O pedido de ligação expirou. Tente de novo.');
  if (q.get('error')) return fail(`A Meta não autorizou a ligação (${q.get('error_description') ?? q.get('error')}).`);
  const code = q.get('code');
  if (!code) return fail('A Meta não devolveu o código de autorização.');

  try {
    const conn = await getAdsClient(env).exchangeCode(code, `${env.APP_URL}/api/oauth/meta-ads/callback`, { fetch, now: () => new Date() });
    if (conn.accounts.length === 0) return fail('Não encontrámos nenhuma conta de anúncios ativa neste perfil do Facebook.');
    const db = createServiceClient();
    await saveAdAccounts(db, env.TOKEN_ENC_KEY, state.brandId, conn);
    await db.from('activity_log').insert({
      brand_id: state.brandId, level: 'info', source: 'oauth:meta_ads',
      message: `Anúncios da Meta ligados: ${conn.accounts.map((a) => a.name).join(', ')}`,
    });
    return done('ligada=anuncios');
  } catch (e) {
    console.error('oauth:meta_ads callback falhou', (e as Error).message);
    return fail(`Não foi possível ligar os anúncios: ${(e as { userMessage?: string }).userMessage ?? (e as Error).message}`);
  }
}
