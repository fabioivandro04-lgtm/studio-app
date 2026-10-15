import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError } from '@/lib/platforms/errors';
import type { Platform, PlatformAdapter, PostMetrics } from '@/lib/platforms/types';
import { runMetricsSync, type MetricsAccount, type MetricsRepo } from './sync';

const NOW = new Date('2026-10-15T10:00:00Z');
const pm = (over: Partial<PostMetrics> = {}): PostMetrics => ({ views: 10, reach: 5, likes: 1, comments: 0, shares: 0, saves: 0, watchTimeS: null, isPublic: true, raw: {}, ...over });

function account(id: string, platform: Platform): MetricsAccount {
  return { id, brandId: 'b', platform, externalId: 'x', accessTokenEnc: 'e', refreshTokenEnc: null, tokenExpiresAt: null, tokenUpdatedAt: NOW };
}

class Repo implements MetricsRepo {
  accounts: MetricsAccount[] = [];
  targets: Record<string, Array<{ targetId: string; externalPostId: string; status: string }>> = {};
  unmatched: Record<string, Array<{ targetId: string; uploadedAt: Date }>> = {};
  linked: Record<string, string[]> = {};
  accountRows = new Map<string, unknown>();
  postRows = new Map<string, unknown>();
  published: Array<[string, string, string | null]> = [];
  reauth: string[] = [];
  async listActiveAccounts() { return this.accounts; }
  async listTargetsForMetrics(id: string) { return this.targets[id] ?? []; }
  async listUnmatchedTikTok(id: string) { return this.unmatched[id] ?? []; }
  async linkedExternalIds(id: string) { return new Set(this.linked[id] ?? []); }
  async upsertAccountMetrics(id: string, day: string, m: unknown) { this.accountRows.set(`${id}|${day}`, m); }
  async upsertPostMetrics(id: string, day: string, m: unknown) { this.postRows.set(`${id}|${day}`, m); }
  async markPublished(id: string, ext: string, link: string | null) { this.published.push([id, ext, link]); }
  async markAccountNeedsReauth(id: string) { this.reauth.push(id); }
  async saveAccountTokens() {}
  async log() {}
}

function adapter(over: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    fetchAccountMetrics: async () => ({ followers: 100, views: 1000, raw: {} }),
    fetchPostMetrics: async (_a: unknown, ids: string[]) => Object.fromEntries(ids.map((id) => [id, pm()])),
    listRecentPosts: async () => [],
    ...over,
  } as PlatformAdapter;
}

let repo: Repo;
const run = (adapters: Partial<Record<Platform, PlatformAdapter>>) =>
  runMetricsSync({ repo, adapters: adapters as Record<Platform, PlatformAdapter>, decrypt: (s) => s, fetch, now: () => NOW });

beforeEach(() => {
  repo = new Repo();
});

describe('runMetricsSync', () => {
  it('grava métricas da conta e dos posts com o dia UTC', async () => {
    repo.accounts = [account('a1', 'instagram')];
    repo.targets.a1 = [{ targetId: 't1', externalPostId: 'm1', status: 'published' }];
    const r = await run({ instagram: adapter() });
    expect(repo.accountRows.get('a1|2026-10-15')).toMatchObject({ followers: 100 });
    expect(repo.postRows.get('t1|2026-10-15')).toMatchObject({ views: 10 });
    expect(r).toEqual({ accounts: 1, posts: 1 });
  });

  it('correr duas vezes no mesmo dia não duplica (upsert)', async () => {
    repo.accounts = [account('a1', 'instagram')];
    repo.targets.a1 = [{ targetId: 't1', externalPostId: 'm1', status: 'published' }];
    await run({ instagram: adapter() });
    await run({ instagram: adapter() });
    expect(repo.postRows.size).toBe(1);
  });

  it('TikTok: associa envios e marca publicados', async () => {
    repo.accounts = [account('a1', 'tiktok')];
    repo.unmatched.a1 = [{ targetId: 't1', uploadedAt: new Date('2026-10-15T08:00:00Z') }];
    repo.linked.a1 = ['old'];
    let since: Date | null = null;
    await run({ tiktok: adapter({
      listRecentPosts: async (_a, s) => {
        since = s;
        return [
          { externalId: 'old', createdAt: new Date('2026-10-15T09:00:00Z'), permalink: null, thumbnailUrl: null, title: null },
          { externalId: 'v1', createdAt: new Date('2026-10-15T09:30:00Z'), permalink: 'https://t/v1', thumbnailUrl: null, title: null },
        ];
      },
    }) });
    expect(since).toEqual(new Date('2026-10-15T08:00:00Z'));
    expect(repo.published).toEqual([['t1', 'v1', 'https://t/v1']]);
  });

  it('YouTube público marca o destino como publicado', async () => {
    repo.accounts = [account('a1', 'youtube')];
    repo.targets.a1 = [
      { targetId: 't1', externalPostId: 'y1', status: 'awaiting_user' },
      { targetId: 't2', externalPostId: 'y2', status: 'awaiting_user' },
    ];
    await run({ youtube: adapter({ fetchPostMetrics: async () => ({ y1: pm({ isPublic: true }), y2: pm({ isPublic: false }) }) }) });
    expect(repo.published).toEqual([['t1', 'y1', null]]);
  });

  it('AuthError numa conta marca needs_reauth e continua com as outras', async () => {
    repo.accounts = [account('a1', 'instagram'), account('a2', 'tiktok')];
    await run({
      instagram: adapter({ fetchAccountMetrics: async () => { throw new AuthError('x'); } }),
      tiktok: adapter(),
    });
    expect(repo.reauth).toEqual(['a1']);
    expect(repo.accountRows.has('a2|2026-10-15')).toBe(true);
  });

  it('pede métricas em lotes de 20', async () => {
    repo.accounts = [account('a1', 'instagram')];
    repo.targets.a1 = Array.from({ length: 45 }, (_, i) => ({ targetId: `t${i}`, externalPostId: `m${i}`, status: 'published' }));
    const sizes: number[] = [];
    await run({ instagram: adapter({ fetchPostMetrics: async (_a, ids) => { sizes.push(ids.length); return {}; } }) });
    expect(sizes).toEqual([20, 20, 5]);
  });
});
