import { describe, expect, it } from 'vitest';
import { toHistoryPoint, toHistoryPoints } from './ai-repo';

const m = (collected_on: string, over: Record<string, number | null> = {}) => ({
  collected_on, reach: null, views: null, profile_visits: null, follows: null, shares: null, saves: null, comments: null, ...over,
});

describe('toHistoryPoint', () => {
  it('usa a métrica mais recente', () => {
    const p = toHistoryPoint({
      published_at: '2026-09-03T17:05:00Z',
      post_metrics: [m('2026-09-04', { reach: 10, profile_visits: 1 }), m('2026-09-10', { reach: 90, profile_visits: 7 }), m('2026-09-05', { reach: 40 })],
    });
    expect(p).toEqual({
      publishedAt: new Date('2026-09-03T17:05:00Z'), reach: 90, views: null, profileVisits: 7, follows: null, shares: null, saves: null, comments: null,
    });
  });

  it('campo nulo no dia mais recente usa o último valor conhecido', () => {
    const p = toHistoryPoint({
      published_at: '2026-09-03T17:05:00Z',
      post_metrics: [m('2026-09-04', { reach: 10, profile_visits: 6, follows: 1 }), m('2026-09-10', { reach: 90, profile_visits: null, follows: null })],
    });
    expect(p).toMatchObject({ reach: 90, profileVisits: 6, follows: 1 });
  });

  it('sem métricas ou sem data de publicação → null', () => {
    expect(toHistoryPoint({ published_at: '2026-09-03T17:05:00Z', post_metrics: [] })).toBeNull();
    expect(toHistoryPoint({ published_at: null, post_metrics: [m('2026-09-04')] })).toBeNull();
  });

  it('converte números vindos como texto (bigint)', () => {
    const p = toHistoryPoint({ published_at: '2026-09-03T17:05:00Z', post_metrics: [m('2026-09-04', { reach: '12' as unknown as number })] });
    expect(p?.reach).toBe(12);
  });
});

describe('toHistoryPoints', () => {
  it('um ponto por post: soma as redes e usa a primeira publicação', () => {
    const pts = toHistoryPoints([
      { post_id: 'p1', published_at: '2026-09-03T17:05:00Z', post_metrics: [m('2026-09-04', { reach: 100, profile_visits: 5 })] },
      { post_id: 'p1', published_at: '2026-09-03T17:01:00Z', post_metrics: [m('2026-09-04', { reach: 40, views: 900 })] },
      { post_id: 'p2', published_at: '2026-09-05T12:00:00Z', post_metrics: [m('2026-09-06', { reach: 7 })] },
      { post_id: 'p3', published_at: '2026-09-07T12:00:00Z', post_metrics: [] },
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ publishedAt: new Date('2026-09-03T17:01:00Z'), reach: 140, views: 900, profileVisits: 5 });
    expect(pts[1]).toMatchObject({ reach: 7, profileVisits: null });
  });
});
