import { decryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { createTickRepo, listActiveAccounts } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { getAdapters } from '@/lib/platforms/registry';
import { refreshExpiringTokens } from '@/lib/publishing/refresh-all';
import { verifyCronAuth } from '../auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  const env = serverEnv();
  if (!verifyCronAuth(req, env.CRON_SECRET)) return new Response('Não autorizado', { status: 401 });
  const db = createServiceClient();
  const repo = createTickRepo(db, env.TOKEN_ENC_KEY);
  const summary = await refreshExpiringTokens({
    repo: { ...repo, listActiveAccounts: () => listActiveAccounts(db) },
    adapters: getAdapters(env),
    decrypt: (enc) => decryptToken(enc, env.TOKEN_ENC_KEY),
    fetch,
    now: () => new Date(),
  });
  return Response.json(summary);
}
