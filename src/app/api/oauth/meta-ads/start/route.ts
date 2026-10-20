import { NextResponse, type NextRequest } from 'next/server';
import { getAdsClient } from '@/lib/ads/registry';
import { createServerClient } from '@/lib/db/clients';
import { serverEnv } from '@/lib/env';
import { createOAuthState } from '@/lib/oauth/state';

/** Liga as contas de anúncios da Meta de uma marca (login pelo Facebook, só leitura). */
export async function GET(request: NextRequest) {
  const back = (msg: string) => NextResponse.redirect(new URL(`/definicoes/contas?erro=${encodeURIComponent(msg)}`, request.url));
  const brandId = request.nextUrl.searchParams.get('brand');
  // RLS: só encontra a marca se o utilizador for o dono.
  const db = await createServerClient();
  const { data: brand } = brandId ? await db.from('brands').select('id').eq('id', brandId).single() : { data: null };
  if (!brand) return back('Escolha uma marca antes de ligar os anúncios.');

  const env = serverEnv();
  const state = createOAuthState(brand.id, 'meta_ads', env.TOKEN_ENC_KEY);
  let authorizeUrl: string;
  try {
    authorizeUrl = getAdsClient(env).authorizeUrl(state, `${env.APP_URL}/api/oauth/meta-ads/callback`);
  } catch (e) {
    return back((e as { userMessage?: string }).userMessage ?? 'Não foi possível iniciar a ligação.');
  }
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set('oauth_state', state, { httpOnly: true, secure: env.APP_URL.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
