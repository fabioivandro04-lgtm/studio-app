import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/db/clients';
import { upsertAccount } from '@/lib/db/repo/accounts-repo';
import { serverEnv } from '@/lib/env';
import { readOAuthState } from '@/lib/oauth/state';
import { getAdapters } from '@/lib/platforms/registry';
import { PLATFORM_LABEL } from '@/lib/platforms/types';

export async function GET(request: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
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
  if (!state || state.platform !== platform) return fail('O pedido de ligação expirou. Tente de novo.');

  const label = PLATFORM_LABEL[state.platform];
  if (q.get('error')) return fail(`O ${label} não autorizou a ligação (${q.get('error_description') ?? q.get('error')}).`);
  const code = q.get('code');
  if (!code) return fail(`O ${label} não devolveu o código de autorização.`);

  try {
    const adapter = getAdapters(env)[state.platform];
    const redirectUri = `${env.APP_URL}/api/oauth/${platform}/callback`;
    const { tokens, profile } = await adapter.exchangeCode(code, redirectUri, { fetch, now: () => new Date() });
    const db = createServiceClient();
    await upsertAccount(db, env.TOKEN_ENC_KEY, state.brandId, state.platform, profile, tokens);
    await db.from('activity_log').insert({
      brand_id: state.brandId, level: 'info', source: `oauth:${state.platform}`, message: `Conta ${label} @${profile.handle} ligada`,
    });
    return done(`ligada=${state.platform}`);
  } catch (e) {
    const msg = (e as { userMessage?: string }).userMessage ?? (e as Error).message;
    return fail(`Não foi possível ligar o ${label}: ${msg}`);
  }
}
