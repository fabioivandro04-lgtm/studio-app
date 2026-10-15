import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError, DeferError, PermanentError, TransientError } from '@/lib/platforms/errors';
import type { AdvanceResult, Platform, PlatformAdapter, TargetCtx } from '@/lib/platforms/types';
import { runTick, type ClaimedTarget, type TickRepo } from './tick';

const NOW = new Date('2026-10-15T10:00:00Z');

function claimed(over: Partial<ClaimedTarget['target']> = {}, acct: Partial<ClaimedTarget['account']> = {}): ClaimedTarget {
  return {
    brandId: 'b1',
    target: {
      id: over.id ?? 't1', postId: 'p1', platform: 'instagram', status: 'pending', attempts: 0,
      format: 'ig_image', caption: 'c', title: null, options: {}, progress: {}, media: [], ...over,
    },
    account: { id: 'a1', externalId: 'IG1', accessTokenEnc: 'enc:tok', refreshTokenEnc: null, tokenExpiresAt: null, ...acct },
  };
}

class MemRepo implements TickRepo {
  claims: ClaimedTarget[] = [];
  saves: Array<[string, Record<string, unknown>]> = [];
  refreshed: string[] = [];
  reauth: Array<[string, string]> = [];
  tokens: Array<[string, unknown]> = [];
  logs: Array<{ level: string; message: string }> = [];
  async claimDueTargets() { return this.claims; }
  async saveTarget(id: string, patch: Record<string, unknown>) { this.saves.push([id, patch]); }
  async refreshPostStatus(postId: string) { this.refreshed.push(postId); }
  async markAccountNeedsReauth(id: string, msg: string) { this.reauth.push([id, msg]); }
  async saveAccountTokens(id: string, t: unknown) { this.tokens.push([id, t]); }
  async usageToday() { return 0; }
  async recordUsage() {}
  async log(e: { level: string; message: string }) { this.logs.push(e); }
}

function adapterWith(advance: (t: TargetCtx) => Promise<AdvanceResult>, extra: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    platform: 'instagram', formats: [], validate: () => [], advance: (t) => advance(t),
    fetchAccountMetrics: async () => ({ followers: null, views: null, raw: null }),
    fetchPostMetrics: async () => ({}), listRecentPosts: async () => [],
    refreshToken: async () => ({ accessToken: 'novo', refreshToken: null, expiresAt: new Date(NOW.getTime() + 3600_000), refreshExpiresAt: null, scopes: [] }),
    authorizeUrl: () => '', exchangeCode: async () => { throw new Error('n/a'); },
    ...extra,
  };
}

let repo: MemRepo;
const run = (adapter: PlatformAdapter) =>
  runTick({
    repo, adapters: { instagram: adapter, tiktok: adapter, youtube: adapter } as Record<Platform, PlatformAdapter>,
    storage: { signedUrl: async () => '', readRange: async () => new Uint8Array() },
    fetch: (async () => new Response()) as unknown as typeof fetch, now: () => NOW,
    decrypt: (e) => e.replace(/^enc:/, ''), budgetMs: 40_000,
  });
const patchOf = (i = 0) => repo.saves[i][1];

beforeEach(() => {
  repo = new MemRepo();
});

describe('runTick', () => {
  it('publicado → saveTarget published + refreshPostStatus + log', async () => {
    repo.claims = [claimed()];
    const seen: string[] = [];
    const r = await run(adapterWith(async (t) => {
      seen.push(t.id);
      return { kind: 'published', progress: { a: 1 }, externalPostId: 'm1', permalink: 'https://p' };
    }));
    expect(seen).toEqual(['t1']);
    expect(patchOf()).toMatchObject({ status: 'published', externalPostId: 'm1', permalink: 'https://p', publishedAt: NOW, lockedUntil: null, lastError: null });
    expect(repo.refreshed).toEqual(['p1']);
    expect(repo.logs[0].level).toBe('info');
    expect(r).toEqual({ claimed: 1, advanced: 1, failed: 0 });
  });

  it('progress → grava estado e progresso', async () => {
    repo.claims = [claimed()];
    await run(adapterWith(async () => ({ kind: 'progress', status: 'processing', progress: { step: 'container' } })));
    expect(patchOf()).toEqual({ status: 'processing', progress: { step: 'container' }, lockedUntil: null });
  });

  it('awaiting_user → grava ids', async () => {
    repo.claims = [claimed()];
    await run(adapterWith(async () => ({ kind: 'awaiting_user', progress: {}, externalPostId: 'yt1', permalink: 'https://yt' })));
    expect(patchOf()).toMatchObject({ status: 'awaiting_user', externalPostId: 'yt1', permalink: 'https://yt' });
  });

  it('TransientError 1.ª vez → attempts 1 e nova tentativa em 1 min', async () => {
    repo.claims = [claimed()];
    await run(adapterWith(async () => { throw new TransientError('x', 'Rede em baixo'); }));
    expect(patchOf()).toEqual({ attempts: 1, nextAttemptAt: new Date('2026-10-15T10:01:00Z'), lastError: 'Rede em baixo', lockedUntil: null });
  });

  it('TransientError com 3 tentativas → failed com a mensagem', async () => {
    repo.claims = [claimed({ attempts: 3 })];
    const r = await run(adapterWith(async () => { throw new TransientError('x', 'Rede em baixo'); }));
    expect(patchOf()).toMatchObject({ status: 'failed', attempts: 4, lastError: 'Rede em baixo' });
    expect(r.failed).toBe(1);
  });

  it('PermanentError → failed sem nova tentativa', async () => {
    repo.claims = [claimed()];
    await run(adapterWith(async () => { throw new PermanentError('x', 'Formato inválido'); }));
    expect(patchOf()).toEqual({ status: 'failed', lastError: 'Formato inválido', lockedUntil: null });
    expect(repo.logs[0].level).toBe('error');
  });

  it('AuthError → conta needs_reauth; destino mantém attempts e estado', async () => {
    repo.claims = [claimed({ attempts: 1, status: 'processing' })];
    await run(adapterWith(async () => { throw new AuthError('x', 'Volte a ligar'); }));
    expect(repo.reauth).toEqual([['a1', 'Volte a ligar']]);
    expect(patchOf()).toEqual({ lockedUntil: null });
  });

  it('DeferError → nextAttemptAt = until, attempts inalterado', async () => {
    repo.claims = [claimed({ attempts: 2 })];
    const until = new Date('2026-10-16T07:00:00Z');
    await run(adapterWith(async () => { throw new DeferError('q', until, 'Quota'); }));
    expect(patchOf()).toEqual({ nextAttemptAt: until, lastError: 'Quota', lockedUntil: null });
    expect(repo.logs[0].level).toBe('warn');
  });

  it('erro num destino não bloqueia os outros', async () => {
    repo.claims = [claimed({ id: 'mau' }), claimed({ id: 'bom' })];
    await run(adapterWith(async (t) => {
      if (t.id === 'mau') throw new Error('rebentou');
      return { kind: 'published', progress: {}, externalPostId: 'x', permalink: null };
    }));
    expect(repo.saves.map(([id, p]) => [id, p.status ?? 'retry'])).toEqual([['mau', 'retry'], ['bom', 'published']]);
  });

  it('token a expirar é renovado antes do advance e gravado', async () => {
    repo.claims = [claimed({}, { tokenExpiresAt: new Date(NOW.getTime() + 60_000), refreshTokenEnc: 'enc:rt' })];
    let used = '';
    await run(adapterWith(async () => ({ kind: 'progress', status: 'processing', progress: {} }), {
      advance: async (_t, a) => { used = a.accessToken; return { kind: 'progress', status: 'processing', progress: {} }; },
    }));
    expect(used).toBe('novo');
    expect(repo.tokens[0][0]).toBe('a1');
  });

  it('desencripta o token da conta', async () => {
    repo.claims = [claimed()];
    let used = '';
    await run(adapterWith(async () => ({ kind: 'progress', status: 'processing', progress: {} }), {
      advance: async (_t, a) => { used = a.accessToken; return { kind: 'progress', status: 'processing', progress: {} }; },
    }));
    expect(used).toBe('tok');
  });
});
