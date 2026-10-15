import { AuthError } from '@/lib/platforms/errors';
import type { AccountMetrics, Platform, PlatformAdapter, PostMetrics, TokenSet } from '@/lib/platforms/types';
import type { RefreshAccount } from '@/lib/publishing/refresh-all';
import type { LogEntry } from '@/lib/publishing/tick';
import { ensureFreshToken } from '@/lib/publishing/tokens';
import { matchTikTokUploads } from './match';

export interface MetricsAccount extends RefreshAccount {
  brandId: string;
}

export interface MetricsRepo {
  listActiveAccounts(): Promise<MetricsAccount[]>;
  /** Destinos com id externo (published ou awaiting_user) publicados/enviados desde `since`. */
  listTargetsForMetrics(accountId: string, since: Date): Promise<Array<{ targetId: string; externalPostId: string; status: string }>>;
  /** Destinos TikTok enviados para a caixa de entrada e ainda sem vídeo associado. */
  listUnmatchedTikTok(accountId: string): Promise<Array<{ targetId: string; uploadedAt: Date }>>;
  linkedExternalIds(accountId: string): Promise<Set<string>>;
  upsertAccountMetrics(accountId: string, day: string, m: AccountMetrics): Promise<void>;
  upsertPostMetrics(targetId: string, day: string, m: PostMetrics): Promise<void>;
  /** `permalink` null mantém o existente. */
  markPublished(targetId: string, externalId: string, permalink: string | null): Promise<void>;
  markAccountNeedsReauth(accountId: string, message: string): Promise<void>;
  saveAccountTokens(accountId: string, tokens: TokenSet): Promise<void>;
  log(e: LogEntry): Promise<void>;
}

export interface MetricsDeps {
  repo: MetricsRepo;
  adapters: Record<Platform, PlatformAdapter>;
  decrypt(enc: string): string;
  fetch: typeof fetch;
  now(): Date;
}

const BATCH = 20;
const WINDOW_DAYS = 30;

async function syncAccount(a: MetricsAccount, deps: MetricsDeps, day: string): Promise<number> {
  const { repo } = deps;
  const adapter = deps.adapters[a.platform];
  const accessToken = await ensureFreshToken(a, adapter, deps);
  const ctx = { id: a.id, externalId: a.externalId, accessToken };
  const fdeps = { fetch: deps.fetch };

  await repo.upsertAccountMetrics(a.id, day, await adapter.fetchAccountMetrics(ctx, fdeps));

  if (a.platform === 'tiktok') {
    const pending = await repo.listUnmatchedTikTok(a.id);
    if (pending.length > 0) {
      const since = new Date(Math.min(...pending.map((p) => p.uploadedAt.getTime())));
      const recent = await adapter.listRecentPosts(ctx, since, fdeps);
      for (const m of matchTikTokUploads(pending, recent, await repo.linkedExternalIds(a.id))) {
        await repo.markPublished(m.targetId, m.post.externalId, m.post.permalink);
      }
    }
  }

  const since = new Date(deps.now().getTime() - WINDOW_DAYS * 86_400_000);
  const targets = await repo.listTargetsForMetrics(a.id, since);
  let count = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const metrics = await adapter.fetchPostMetrics(ctx, batch.map((t) => t.externalPostId), fdeps);
    for (const t of batch) {
      const m = metrics[t.externalPostId];
      if (!m) continue;
      await repo.upsertPostMetrics(t.targetId, day, m);
      count++;
      if (a.platform === 'youtube' && t.status === 'awaiting_user' && m.isPublic === true) {
        await repo.markPublished(t.targetId, t.externalPostId, null);
      }
    }
  }
  return count;
}

/** Job diário: métricas das contas e dos posts dos últimos 30 dias. Uma conta com erro não pára as outras. */
export async function runMetricsSync(deps: MetricsDeps): Promise<{ accounts: number; posts: number }> {
  const day = deps.now().toISOString().slice(0, 10);
  let accounts = 0;
  let posts = 0;
  for (const a of await deps.repo.listActiveAccounts()) {
    try {
      posts += await syncAccount(a, deps, day);
      accounts++;
    } catch (e) {
      const msg = (e as { userMessage?: string }).userMessage ?? (e as Error).message;
      if (e instanceof AuthError) await deps.repo.markAccountNeedsReauth(a.id, msg);
      await deps.repo.log({ brandId: a.brandId, level: 'warn', source: `metrics:${a.platform}`, message: `Métricas não recolhidas: ${msg}`, context: { accountId: a.id } });
    }
  }
  return { accounts, posts };
}
