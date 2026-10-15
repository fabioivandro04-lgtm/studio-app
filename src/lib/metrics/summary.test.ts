import { describe, expect, it } from 'vitest';
import { followerSeries, summarize, type MetricRow } from './summary';

const row = (targetId: string, platform: MetricRow['platform'], collectedOn: string, views: number | null, extra: Partial<MetricRow> = {}): MetricRow => ({
  targetId, platform, collectedOn, views, reach: null, likes: null, comments: null, shares: null, saves: null, watchTimeS: null, ...extra,
});

describe('summarize', () => {
  it('usa a última linha de cada destino no período (não soma dias)', () => {
    const r = summarize([row('t1', 'instagram', '2026-10-10', 100), row('t1', 'instagram', '2026-10-12', 150), row('t2', 'tiktok', '2026-10-11', 40)], '2026-10-01', '2026-10-15');
    expect(r.totals.views).toBe(190);
    expect(r.latestPerTarget.get('t1')?.views).toBe(150);
  });

  it('ignora linhas fora do período', () => {
    const r = summarize([row('t1', 'instagram', '2026-09-30', 999), row('t1', 'instagram', '2026-10-02', 10)], '2026-10-01', '2026-10-15');
    expect(r.totals.views).toBe(10);
  });

  it('nulos contam como 0', () => {
    const r = summarize([row('t1', 'youtube', '2026-10-05', null, { likes: 3 })], '2026-10-01', '2026-10-15');
    expect(r.totals).toMatchObject({ views: 0, likes: 3, saves: 0 });
  });

  it('separa por rede', () => {
    const r = summarize([row('a', 'instagram', '2026-10-05', 5), row('b', 'tiktok', '2026-10-05', 7)], '2026-10-01', '2026-10-15');
    expect(r.byPlatform.instagram.views).toBe(5);
    expect(r.byPlatform.tiktok.views).toBe(7);
    expect(r.byPlatform.youtube.views).toBe(0);
  });
});

describe('followerSeries', () => {
  it('uma linha por dia com uma coluna por conta', () => {
    expect(followerSeries([
      { socialAccountId: 'a', collectedOn: '2026-10-02', followers: 10, views: null },
      { socialAccountId: 'b', collectedOn: '2026-10-01', followers: 5, views: null },
      { socialAccountId: 'a', collectedOn: '2026-10-01', followers: 8, views: null },
    ])).toEqual([{ day: '2026-10-01', a: 8, b: 5 }, { day: '2026-10-02', a: 10 }]);
  });

  it('seguidores ganhos = último − primeiro de cada conta', async () => {
    const { followersGained } = await import('./summary');
    expect(followersGained([
      { socialAccountId: 'a', collectedOn: '2026-10-01', followers: 8, views: null },
      { socialAccountId: 'a', collectedOn: '2026-10-05', followers: 20, views: null },
      { socialAccountId: 'b', collectedOn: '2026-10-03', followers: 5, views: null },
    ])).toBe(12);
  });
});
