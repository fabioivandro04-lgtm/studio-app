import { describe, expect, it } from 'vitest';
import { AuthError, PermanentError, TransientError } from '@/lib/platforms/errors';
import type { PlatformAdapter, TokenSet } from '@/lib/platforms/types';
import { ensureFreshToken } from './tokens';

const NOW = new Date('2026-10-15T10:00:00Z');
const fresh: TokenSet = { accessToken: 'novo', refreshToken: 'rt2', expiresAt: new Date('2026-10-15T11:00:00Z'), refreshExpiresAt: null, scopes: [] };

const adapter = (refresh: PlatformAdapter['refreshToken']) => ({ refreshToken: refresh }) as unknown as PlatformAdapter;
const deps = (saved: unknown[] = []) => ({
  repo: { saveAccountTokens: async (_id: string, t: TokenSet) => { saved.push(t); } },
  decrypt: (e: string) => e.replace(/^enc:/, ''), fetch: fetch, now: () => NOW,
});
const account = (expiresInMs: number | null) => ({
  id: 'a', externalId: 'x', accessTokenEnc: 'enc:velho', refreshTokenEnc: 'enc:rt',
  tokenExpiresAt: expiresInMs == null ? null : new Date(NOW.getTime() + expiresInMs),
});

describe('ensureFreshToken', () => {
  it('token válido por mais de 5 min não é renovado', async () => {
    expect(await ensureFreshToken(account(10 * 60_000), adapter(async () => fresh), deps())).toBe('velho');
  });

  it('sem data de expiração não renova', async () => {
    expect(await ensureFreshToken(account(null), adapter(async () => fresh), deps())).toBe('velho');
  });

  it('a expirar em menos de 5 min é renovado e gravado', async () => {
    const saved: unknown[] = [];
    let args: unknown;
    const tok = await ensureFreshToken(account(60_000), adapter(async (t) => { args = t; return fresh; }), deps(saved));
    expect(tok).toBe('novo');
    expect(args).toEqual({ accessToken: 'velho', refreshToken: 'rt' });
    expect(saved).toEqual([fresh]);
  });

  it('falha definitiva a renovar → AuthError', async () => {
    await expect(
      ensureFreshToken(account(0), adapter(async () => { throw new PermanentError('x'); }), deps()),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it('falha temporária a renovar continua temporária', async () => {
    await expect(
      ensureFreshToken(account(0), adapter(async () => { throw new TransientError('x'); }), deps()),
    ).rejects.toBeInstanceOf(TransientError);
  });
});
