import { requestJson } from '../http';
import type { AccountProfile, TokenSet } from '../types';
import { TT_BASE, ttApi, type TtConfig } from './api';

const SCOPES = ['user.info.basic', 'user.info.stats', 'video.upload', 'video.list'];

export function ttAuthorizeUrl(cfg: TtConfig, state: string, redirectUri: string): string {
  const qs = new URLSearchParams({
    client_key: cfg.clientKey,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${qs}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id?: string;
  scope?: string;
}

async function tokenRequest(fetchFn: typeof fetch, params: Record<string, string>): Promise<TokenResponse> {
  return (
    await requestJson<TokenResponse>(fetchFn, `${TT_BASE}/oauth/token/`, {
      platform: 'tiktok',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })
  ).body;
}

const toTokenSet = (r: TokenResponse, now: Date): TokenSet => ({
  accessToken: r.access_token,
  refreshToken: r.refresh_token ?? null,
  expiresAt: new Date(now.getTime() + r.expires_in * 1000),
  refreshExpiresAt: r.refresh_expires_in ? new Date(now.getTime() + r.refresh_expires_in * 1000) : null,
  scopes: (r.scope ?? '').split(',').filter(Boolean),
});

export async function ttExchangeCode(
  cfg: TtConfig,
  code: string,
  redirectUri: string,
  deps: { fetch: typeof fetch; now(): Date },
): Promise<{ tokens: TokenSet; profile: AccountProfile }> {
  const r = await tokenRequest(deps.fetch, {
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const info = await ttApi(deps.fetch, r.access_token).get('/user/info/', {
    fields: 'open_id,avatar_url,display_name,username',
  });
  const u = info.data?.user ?? {};
  return {
    tokens: toTokenSet(r, deps.now()),
    profile: {
      externalId: String(u.open_id ?? r.open_id),
      handle: u.username ?? u.display_name ?? 'tiktok',
      displayName: u.display_name ?? u.username ?? 'TikTok',
      avatarUrl: u.avatar_url ?? null,
    },
  };
}

export async function ttRefreshToken(
  cfg: TtConfig,
  refreshToken: string,
  deps: { fetch: typeof fetch; now(): Date },
): Promise<TokenSet> {
  const r = await tokenRequest(deps.fetch, {
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return toTokenSet(r, deps.now());
}
