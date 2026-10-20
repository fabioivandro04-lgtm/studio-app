import { describe, expect, it } from 'vitest';
import { buildWeekFacts, lastFullWeek, type PublishedTarget } from './week';

describe('semana do relatório', () => {
  it('a última semana completa vai de segunda a domingo no fuso da marca', () => {
    // Terça, 20 out 2026 → semana de 12 a 18 out.
    expect(lastFullWeek(new Date('2026-10-20T10:00:00Z'), 'Africa/Maputo')).toEqual({ weekStart: '2026-10-12', weekEnd: '2026-10-18' });
    // Segunda às 00:30 em Maputo (ainda domingo em UTC) já conta como a nova semana.
    expect(lastFullWeek(new Date('2026-10-18T22:30:00Z'), 'Africa/Maputo')).toEqual({ weekStart: '2026-10-12', weekEnd: '2026-10-18' });
    expect(lastFullWeek(new Date('2026-10-18T20:00:00Z'), 'Africa/Maputo')).toEqual({ weekStart: '2026-10-05', weekEnd: '2026-10-11' });
  });

  it('soma só os posts da semana e compara com a anterior', () => {
    const t = (title: string, publishedOn: string, views: number): PublishedTarget => ({
      title, platform: 'instagram', publishedOn, views, reach: views / 2, likes: 1, comments: 0, shares: 0, saves: null,
    });
    const facts = buildWeekFacts({
      weekStart: '2026-10-12', weekEnd: '2026-10-18',
      targets: [t('A', '2026-10-13', 100), t('B', '2026-10-18', 300), t('Antigo', '2026-10-07', 50), t('Fora', '2026-10-19', 999)],
      followersGained: 12,
      ads: [{ spend: 0, currency: 'EUR', impressions: 0, reach: 0, linkClicks: 0, leads: 0, conversations: 0 }, { spend: 10, currency: 'EUR', impressions: 900, reach: 500, linkClicks: 20, leads: 1, conversations: 3 }],
      scheduledNextWeek: 4,
    });
    expect(facts).toMatchObject({ postsPublished: 2, views: 400, reach: 200, likes: 2, saves: 0, previous: { views: 50, reach: 25, likes: 1 }, followersGained: 12, scheduledNextWeek: 4 });
    expect(facts.topPosts.map((p) => p.title)).toEqual(['B', 'A']);
    expect(facts.ads).toEqual([{ spend: 10, currency: 'EUR', reach: 500, linkClicks: 20, conversations: 3, leads: 1 }]);
  });
});
