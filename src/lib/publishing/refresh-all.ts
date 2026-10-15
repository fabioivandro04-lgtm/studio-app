import { TransientError } from '@/lib/platforms/errors';
import type { Platform, PlatformAdapter, TokenSet } from '@/lib/platforms/types';
import type { LogEntry } from './tick';
import type { AccountTokens } from './tokens';

export interface RefreshAccount extends AccountTokens {
  platform: Platform;
  tokenUpdatedAt: Date;
}

export interface RefreshDeps {
  repo: {
    listActiveAccounts(): Promise<RefreshAccount[]>;
    saveAccountTokens(accountId: string, tokens: TokenSet): Promise<void>;
    markAccountNeedsReauth(accountId: string, message: string): Promise<void>;
    log(e: LogEntry): Promise<void>;
  };
  adapters: Record<Platform, PlatformAdapter>;
  decrypt(enc: string): string;
  fetch: typeof fetch;
  now(): Date;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function needsRefresh(a: RefreshAccount, now: Date): boolean {
  if (!a.tokenExpiresAt) return false;
  const left = a.tokenExpiresAt.getTime() - now.getTime();
  switch (a.platform) {
    case 'instagram':
      // O Instagram só renova tokens com pelo menos 24 h.
      return left < 7 * DAY && now.getTime() - a.tokenUpdatedAt.getTime() >= DAY;
    case 'tiktok':
      return left < 2 * HOUR;
    case 'youtube':
      return false; // renovado no momento do uso
  }
}

/** Job diário: renova tokens prestes a expirar. Falhas definitivas → conta needs_reauth. */
export async function refreshExpiringTokens(deps: RefreshDeps): Promise<{ refreshed: number; failed: number }> {
  const now = deps.now();
  let refreshed = 0;
  let failed = 0;
  for (const a of await deps.repo.listActiveAccounts()) {
    if (!needsRefresh(a, now)) continue;
    try {
      const tokens = await deps.adapters[a.platform].refreshToken(
        { accessToken: deps.decrypt(a.accessTokenEnc), refreshToken: a.refreshTokenEnc ? deps.decrypt(a.refreshTokenEnc) : null },
        { fetch: deps.fetch, now: deps.now },
      );
      await deps.repo.saveAccountTokens(a.id, tokens);
      refreshed++;
    } catch (e) {
      const msg = (e as { userMessage?: string }).userMessage ?? (e as Error).message;
      if (e instanceof TransientError) {
        await deps.repo.log({ level: 'warn', source: `tokens:${a.platform}`, message: `Renovação adiada: ${msg}`, context: { accountId: a.id } });
        continue;
      }
      failed++;
      await deps.repo.markAccountNeedsReauth(a.id, 'A ligação à conta expirou. Volte a ligar a conta.');
      await deps.repo.log({ level: 'error', source: `tokens:${a.platform}`, message: `Renovação falhou: ${msg}`, context: { accountId: a.id } });
    }
  }
  return { refreshed, failed };
}
