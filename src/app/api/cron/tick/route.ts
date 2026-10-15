import { decryptToken } from '@/lib/crypto/tokens';
import { createServiceClient } from '@/lib/db/clients';
import { createTickRepo } from '@/lib/db/repo/tick-repo';
import { serverEnv } from '@/lib/env';
import { createSupabaseStorage } from '@/lib/media/storage';
import { getAdapters } from '@/lib/platforms/registry';
import { runTick } from '@/lib/publishing/tick';
import { verifyCronAuth } from '../auth';

export const maxDuration = 60;

export async function POST(req: Request) {
  const env = serverEnv();
  if (!verifyCronAuth(req, env.CRON_SECRET)) return new Response('Não autorizado', { status: 401 });
  const db = createServiceClient();
  const summary = await runTick({
    repo: createTickRepo(db, env.TOKEN_ENC_KEY),
    adapters: getAdapters(env),
    storage: createSupabaseStorage(db),
    fetch,
    now: () => new Date(),
    decrypt: (enc) => decryptToken(enc, env.TOKEN_ENC_KEY),
    budgetMs: 40_000,
    limit: 5,
  });
  return Response.json(summary);
}
