import { AuthError, TransientError } from '@/lib/platforms/errors';
import type { PlatformAdapter, TokenSet } from '@/lib/platforms/types';

export interface AccountTokens {
  id: string;
  externalId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}

const REFRESH_MARGIN_MS = 5 * 60_000;

/** Devolve um access token válido, renovando-o se expirar nos próximos 5 minutos. */
export async function ensureFreshToken(
  account: AccountTokens,
  adapter: PlatformAdapter,
  deps: {
    repo: { saveAccountTokens(accountId: string, tokens: TokenSet): Promise<void> };
    decrypt(enc: string): string;
    fetch: typeof fetch;
    now(): Date;
  },
): Promise<string> {
  const accessToken = deps.decrypt(account.accessTokenEnc);
  const exp = account.tokenExpiresAt;
  if (!exp || exp.getTime() - deps.now().getTime() > REFRESH_MARGIN_MS) return accessToken;

  let tokens: TokenSet;
  try {
    tokens = await adapter.refreshToken(
      { accessToken, refreshToken: account.refreshTokenEnc ? deps.decrypt(account.refreshTokenEnc) : null },
      { fetch: deps.fetch, now: deps.now },
    );
  } catch (e) {
    if (e instanceof TransientError) throw e;
    throw new AuthError(`Renovação do token falhou: ${(e as Error).message}`, 'A ligação à conta expirou. Volte a ligar a conta.');
  }
  await deps.repo.saveAccountTokens(account.id, tokens);
  return tokens.accessToken;
}
