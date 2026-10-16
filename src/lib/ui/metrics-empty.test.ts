import { describe, expect, it } from 'vitest';
import { hasPostMetrics, showFollowersChart } from './metrics-empty';

describe('métricas sem dados', () => {
  it('sem linhas de métricas de posts → estado vazio', () => {
    expect(hasPostMetrics([])).toBe(false);
    expect(hasPostMetrics([{ targetId: 't' }])).toBe(true);
  });
  it('gráfico de seguidores só com 2 dias ou mais', () => {
    expect(showFollowersChart([])).toBe(false);
    expect(showFollowersChart([{ day: '2026-10-16' }])).toBe(false);
    expect(showFollowersChart([{ day: '2026-10-16' }, { day: '2026-10-17' }])).toBe(true);
  });
});
