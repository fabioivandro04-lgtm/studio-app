import { describe, expect, it } from 'vitest';
import type { GridItem } from '@/lib/instagram/grid';
import { describeGrid, metricsReport, weekdayName } from './insights';

describe('describeGrid', () => {
  it('numera os 12 primeiros quadrados em linhas de 3, planeados com estado/formato/data', () => {
    const items: GridItem[] = [
      { kind: 'planned', key: 'a', href: '/posts/a', thumbUrl: null, at: new Date('2026-10-21T17:00:00Z'), status: 'draft', title: 'Bolsa China', format: 'ig_reel' },
      { kind: 'planned', key: 'b', href: '/posts/b', thumbUrl: 'x', at: new Date('2026-10-20T17:00:00Z'), status: 'scheduled', title: '', format: 'ig_carousel' },
      ...Array.from({ length: 12 }, (_, i): GridItem => ({ kind: 'published', key: `p${i}`, href: `https://ig/${i}`, thumbUrl: null, at: new Date(`2026-10-${String(10 - (i % 9)).padStart(2, '0')}T12:00:00Z`) })),
    ];
    const text = describeGrid(items, 'Africa/Maputo');
    const lines = text.split('\n');
    expect(lines[0]).toBe('Linha 1:');
    expect(lines[1]).toBe('1. [planeado · rascunho · Reel · qua, 21 out 19:00] Bolsa China (sem imagem)');
    expect(lines[2]).toBe('2. [planeado · agendado · Carrossel · ter, 20 out 19:00] (sem título)');
    expect(lines[3]).toMatch(/^3\. \[publicado · /);
    expect(text).toContain('Linha 4:');
    expect(text).not.toContain('13.');
  });
  it('grelha vazia', () => {
    expect(describeGrid([], 'Africa/Maputo')).toBe('A grelha está vazia: sem posts planeados nem publicados.');
  });
});

describe('metricsReport', () => {
  it('totais, por rede, top 5 por visualizações e melhores horas', () => {
    const rows = [
      { targetId: 't1', platform: 'instagram' as const, collectedOn: '2026-10-10', views: 100, reach: 80, likes: 10, comments: 1, shares: 2, saves: 3, watchTimeS: null },
      { targetId: 't1', platform: 'instagram' as const, collectedOn: '2026-10-12', views: 300, reach: 200, likes: 30, comments: 2, shares: 4, saves: 5, watchTimeS: null },
      { targetId: 't2', platform: 'tiktok' as const, collectedOn: '2026-10-12', views: 50, reach: null, likes: 5, comments: 0, shares: 0, saves: null, watchTimeS: null },
    ];
    const info = new Map([['t1', { title: 'Reel A', link: 'https://ig/a' }], ['t2', { title: 'TT B', link: null }]]);
    const r = metricsReport({ rows, info, from: '2026-09-21', to: '2026-10-20', followersGained: 12, best: [{ weekday: 2, hour: 19, median: 1, count: 3 }] });
    expect(r.totais).toEqual({ views: 350, reach: 200, likes: 35, comments: 2, shares: 4, saves: 5 });
    expect(r.porRede.instagram.views).toBe(300);
    expect(r.top.map((p) => p.titulo)).toEqual(['Reel A', 'TT B']);
    expect(r.melhoresHoras).toEqual(['terça às 19h']);
    expect(r.seguidoresGanhos).toBe(12);
  });
  it('weekdayName', () => {
    expect(weekdayName(0)).toBe('domingo');
  });
});
