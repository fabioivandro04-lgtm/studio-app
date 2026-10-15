import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/db/clients';
import { serverEnv } from '@/lib/env';
import { createOAuthState } from '@/lib/oauth/state';
import { getAdapters } from '@/lib/platforms/registry';
import type { Platform } from '@/lib/platforms/types';

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube'];

export async function GET(request: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const back = (msg: string) => NextResponse.redirect(new URL(`/definicoes/contas?erro=${encodeURIComponent(msg)}`, request.url));
  if (!PLATFORMS.includes(platform as Platform)) return back('Rede desconhecida.');

  const db = await createServerClient();
  let brandId = request.nextUrl.searchParams.get('brand');
  const accountId = request.nextUrl.searchParams.get('conta');
  if (!brandId && accountId) {
    const { data } = await db.from('social_accounts').select('brand_id').eq('id', accountId).single();
    brandId = data?.brand_id ?? null;
  }
  // RLS: só encontra a marca se o utilizador for o dono.
  const { data: brand } = brandId ? await db.from('brands').select('id').eq('id', brandId).single() : { data: null };
  if (!brand) return back('Escolha uma marca antes de ligar a conta.');

  const env = serverEnv();
  const state = createOAuthState(brand.id, platform as Platform, env.TOKEN_ENC_KEY);
  const redirectUri = `${env.APP_URL}/api/oauth/${platform}/callback`;
  const res = NextResponse.redirect(getAdapters(env)[platform as Platform].authorizeUrl(state, redirectUri));
  res.cookies.set('oauth_state', state, { httpOnly: true, secure: env.APP_URL.startsWith('https'), sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
