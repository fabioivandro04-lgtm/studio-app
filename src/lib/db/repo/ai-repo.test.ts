import { describe, expect, it } from 'vitest';
import { toHistoryPoint } from './ai-repo';

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

  it('sem métricas ou sem data de publicação → null', () => {
    expect(toHistoryPoint({ published_at: '2026-09-03T17:05:00Z', post_metrics: [] })).toBeNull();
    expect(toHistoryPoint({ published_at: null, post_metrics: [m('2026-09-04')] })).toBeNull();
  });

  it('converte números vindos como texto (bigint)', () => {
    const p = toHistoryPoint({ published_at: '2026-09-03T17:05:00Z', post_metrics: [m('2026-09-04', { reach: '12' as unknown as number })] });
    expect(p?.reach).toBe(12);
  });
});
