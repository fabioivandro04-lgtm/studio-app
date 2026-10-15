import { describe, expect, it } from 'vitest';
import { PermanentError } from '@/lib/platforms/errors';
import type { Platform, PlatformAdapter, TokenSet } from '@/lib/platforms/types';
import { refreshExpiringTokens, type RefreshAccount } from './refresh-all';

const NOW = new Date('2026-10-15T10:00:00Z');
const DAY = 86_400_000;
const tokens: TokenSet = { accessToken: 'novo', refreshToken: null, expiresAt: new Date(NOW.getTime() + 60 * DAY), refreshExpiresAt: null, scopes: [] };

function acct(platform: Platform, expiresInMs: number, tokenAgeMs = 10 * DAY): RefreshAccount {
  return {
    id: `${platform}-${expiresInMs}`, platform, externalId: 'x', accessTokenEnc: 'enc', refreshTokenEnc: 'enc',
    tokenExpiresAt: new Date(NOW.getTime() + expiresInMs), tokenUpdatedAt: new Date(NOW.getTime() - tokenAgeMs),
  };
}

function setup(accounts: RefreshAccount[], fail = false) {
  const saved: string[] = [];
  const reauth: string[] = [];
  const adapter = {
    refreshToken: async () => {
      if (fail) throw new PermanentError('x', 'revogado');
      return tokens;
    },
  } as unknown as PlatformAdapter;
  const deps = {
    repo: {
      listActiveAccounts: async () => accounts,
      saveAccountTokens: async (id: string) => { saved.push(id); },
      markAccountNeedsReauth: async (id: string) => { reauth.push(id); },
      log: async () => {},
    },
    adapters: { instagram: adapter, tiktok: adapter, youtube: adapter },
    decrypt: (s: string) => s, fetch, now: () => NOW,
  };
  return { deps, saved, reauth };
}

describe('refreshExpiringTokens', () => {
  it('Instagram a expirar em 3 dias é renovado', async () => {
    const { deps, saved } = setup([acct('instagram', 3 * DAY)]);
    expect(await refreshExpiringTokens(deps)).toEqual({ refreshed: 1, failed: 0 });
    expect(saved).toHaveLength(1);
  });

  it('Instagram com mais de 7 dias de validade não é renovado', async () => {
    const { deps, saved } = setup([acct('instagram', 8 * DAY)]);
    await refreshExpiringTokens(deps);
    expect(saved).toHaveLength(0);
  });

  it('Instagram criado há menos de 24 h não é renovado', async () => {
    const { deps, saved } = setup([acct('instagram', 3 * DAY, 2 * 3600_000)]);
    await refreshExpiringTokens(deps);
    expect(saved).toHaveLength(0);
  });

  it('TikTok a expirar em 1 h é renovado; com 3 h não', async () => {
    const { deps, saved } = setup([acct('tiktok', 3600_000), acct('tiktok', 3 * 3600_000)]);
    await refreshExpiringTokens(deps);
    expect(saved).toEqual(['tiktok-3600000']);
  });

  it('YouTube não é renovado pelo job diário', async () => {
    const { deps, saved } = setup([acct('youtube', 60_000)]);
    await refreshExpiringTokens(deps);
    expect(saved).toHaveLength(0);
  });

  it('falha → needs_reauth', async () => {
    const { deps, reauth } = setup([acct('tiktok', 60_000)], true);
    expect(await refreshExpiringTokens(deps)).toEqual({ refreshed: 0, failed: 1 });
    expect(reauth).toEqual(['tiktok-60000']);
  });
});
