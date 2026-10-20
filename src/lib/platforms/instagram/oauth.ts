import { requestJson } from '../http';
import type { AccountProfile, TokenSet } from '../types';
import { igApi, type IgConfig } from './api';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_business_manage_messages',
];

export function igAuthorizeUrl(cfg: IgConfig, state: string, redirectUri: string): string {
  const qs = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${qs}`;
}

const tokenSet = (accessToken: string, expiresIn: number | undefined, now: Date): TokenSet => ({
  accessToken,
  refreshToken: null,
  expiresAt: expiresIn ? new Date(now.getTime() + expiresIn * 1000) : null,
  refreshExpiresAt: null,
  scopes: SCOPES,
});

export async function igExchangeCode(
  cfg: IgConfig,
  code: string,
  redirectUri: string,
  deps: { fetch: typeof fetch; now(): Date },
): Promise<{ tokens: TokenSet; profile: AccountProfile }> {
  const short = await requestJson<{ access_token: string }>(deps.fetch, 'https://api.instagram.com/oauth/access_token', {
    platform: 'instagram',
    method: 'POST',
    body: new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const qs = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: cfg.appSecret,
    access_token: short.body.access_token,
  });
  const long = await requestJson<{ access_token: string; expires_in: number }>(
    deps.fetch,
    `https://graph.instagram.com/access_token?${qs}`,
    { platform: 'instagram' },
  );
  const me = await igApi(cfg, deps.fetch, long.body.access_token).get('/me', {
    fields: 'user_id,username,name,profile_picture_url',
  });
  return {
    tokens: tokenSet(long.body.access_token, long.body.expires_in, deps.now()),
    profile: {
      externalId: String(me.user_id ?? me.id),
      handle: me.username,
      displayName: me.name || me.username,
      avatarUrl: me.profile_picture_url ?? null,
    },
  };
}

export async function igRefreshToken(accessToken: string, deps: { fetch: typeof fetch; now(): Date }): Promise<TokenSet> {
  const qs = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken });
  const r = await requestJson<{ access_token: string; expires_in: number }>(
    deps.fetch,
    `https://graph.instagram.com/refresh_access_token?${qs}`,
    { platform: 'instagram' },
  );
  return tokenSet(r.body.access_token, r.body.expires_in, deps.now());
}
