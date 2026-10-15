import { decryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { createMetricsRepo } from '@/lib/db/repo/metrics-repo';
import { serverEnv } from '@/lib/env';
import { runMetricsSync } from '@/lib/metrics/sync';
import { getAdapters } from '@/lib/platforms/registry';
import { verifyCronAuth } from '../auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  const env = serverEnv();
  if (!verifyCronAuth(req, env.CRON_SECRET)) return new Response('Não autorizado', { status: 401 });
  const summary = await runMetricsSync({
    repo: createMetricsRepo(createServiceClient(), env.TOKEN_ENC_KEY),
    adapters: getAdapters(env),
    decrypt: (enc) => decryptToken(enc, env.TOKEN_ENC_KEY),
    fetch,
    now: () => new Date(),
  });
  return Response.json(summary);
}
