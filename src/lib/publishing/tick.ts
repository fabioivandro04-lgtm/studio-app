import { AuthError, DeferError, PermanentError, TransientError } from '@/lib/platforms/errors';
import type {
  AdvanceResult, Platform, PlatformAdapter, Progress, TargetCtx, TargetStatus, TokenSet,
} from '@/lib/platforms/types';
import type { MediaStorage } from '@/lib/media/storage';
import { nextRetryAt } from './retry';
import { ensureFreshToken, type AccountTokens } from './tokens';

export interface ClaimedTarget {
  brandId: string;
  target: TargetCtx & { postId: string; status: TargetStatus; attempts: number; platform: Platform };
  account: AccountTokens;
}

export interface TargetPatch {
  status?: TargetStatus;
  progress?: Progress;
  attempts?: number;
  nextAttemptAt?: Date | null;
  externalPostId?: string | null;
  permalink?: string | null;
  lastError?: string | null;
  publishedAt?: Date | null;
  lockedUntil?: Date | null;
}

export interface LogEntry {
  brandId?: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  context?: unknown;
}

export interface TickRepo {
  claimDueTargets(limit: number): Promise<ClaimedTarget[]>;
  saveTarget(id: string, patch: TargetPatch): Promise<void>;
  refreshPostStatus(postId: string): Promise<void>;
  markAccountNeedsReauth(accountId: string, message: string): Promise<void>;
  saveAccountTokens(accountId: string, tokens: TokenSet): Promise<void>;
  usageToday(accountId: string, kind: string): Promise<number>;
  recordUsage(accountId: string, kind: string, units: number): Promise<void>;
  log(e: LogEntry): Promise<void>;
}

export interface TickDeps {
  repo: TickRepo;
  adapters: Record<Platform, PlatformAdapter>;
  storage: MediaStorage;
  fetch: typeof fetch;
  now(): Date;
  decrypt(enc: string): string;
  budgetMs: number;
  limit?: number;
}

function resultPatch(r: AdvanceResult, now: Date): TargetPatch {
  switch (r.kind) {
    case 'progress':
      return { status: r.status, progress: r.progress, lockedUntil: null };
    case 'awaiting_user':
      return { status: 'awaiting_user', progress: r.progress, externalPostId: r.externalPostId, permalink: r.permalink, lastError: null, lockedUntil: null };
    case 'published':
      return { status: 'published', progress: r.progress, externalPostId: r.externalPostId, permalink: r.permalink, publishedAt: now, lastError: null, lockedUntil: null };
  }
}

const RESULT_MESSAGE: Record<AdvanceResult['kind'], string> = {
  progress: 'Envio em curso',
  awaiting_user: 'Enviado — aguarda 1 toque na app',
  published: 'Publicado',
};

/** Avança um passo de cada destino devido. Nunca lança: os erros ficam no destino e no registo. */
export async function runTick(deps: TickDeps): Promise<{ claimed: number; advanced: number; failed: number }> {
  const { repo } = deps;
  const deadline = new Date(deps.now().getTime() + deps.budgetMs);
  const claimed = await repo.claimDueTargets(deps.limit ?? 5);
  let advanced = 0;
  let failed = 0;

  for (const c of claimed) {
    const { target, account } = c;
    const source = `publish:${target.platform}`;
    const context = { targetId: target.id, postId: target.postId, format: target.format };
    try {
      const adapter = deps.adapters[target.platform];
      const accessToken = await ensureFreshToken(account, adapter, deps);
      const result = await adapter.advance(target, { id: account.id, externalId: account.externalId, accessToken }, {
        fetch: deps.fetch,
        storage: deps.storage,
        now: deps.now,
        deadline,
        usageToday: (kind) => repo.usageToday(account.id, kind),
        recordUsage: (kind, units) => repo.recordUsage(account.id, kind, units),
      });
      await repo.saveTarget(target.id, resultPatch(result, deps.now()));
      advanced++;
      if (result.kind !== 'progress') {
        await repo.log({ brandId: c.brandId, level: 'info', source, message: RESULT_MESSAGE[result.kind], context });
      }
    } catch (e) {
      const err = e as Error & { userMessage?: string };
      const userMessage = err.userMessage ?? `Erro inesperado: ${err.message}`;
      const logCtx = { ...context, error: err.message };
      if (e instanceof AuthError) {
        await repo.markAccountNeedsReauth(account.id, userMessage);
        await repo.saveTarget(target.id, { lockedUntil: null });
        await repo.log({ brandId: c.brandId, level: 'warn', source, message: userMessage, context: logCtx });
      } else if (e instanceof DeferError) {
        await repo.saveTarget(target.id, { nextAttemptAt: e.until, lastError: userMessage, lockedUntil: null });
        await repo.log({ brandId: c.brandId, level: 'warn', source, message: userMessage, context: logCtx });
      } else if (e instanceof PermanentError) {
        failed++;
        await repo.saveTarget(target.id, { status: 'failed', lastError: userMessage, lockedUntil: null });
        await repo.log({ brandId: c.brandId, level: 'error', source, message: userMessage, context: logCtx });
      } else {
        // TransientError ou erro inesperado: nova tentativa com espera crescente.
        const attempts = target.attempts + 1;
        const next = nextRetryAt(attempts, deps.now());
        if (next) {
          await repo.saveTarget(target.id, { attempts, nextAttemptAt: next, lastError: userMessage, lockedUntil: null });
          await repo.log({ brandId: c.brandId, level: 'warn', source, message: `${userMessage} (nova tentativa)`, context: logCtx });
        } else {
          failed++;
          await repo.saveTarget(target.id, { status: 'failed', attempts, lastError: userMessage, lockedUntil: null });
          await repo.log({ brandId: c.brandId, level: 'error', source, message: userMessage, context: logCtx });
        }
        if (!(e instanceof TransientError)) console.error('[tick] erro inesperado', e);
      }
    } finally {
      await repo.refreshPostStatus(target.postId).catch((e) => console.error('[tick] refreshPostStatus', e));
    }
  }
  return { claimed: claimed.length, advanced, failed };
}
