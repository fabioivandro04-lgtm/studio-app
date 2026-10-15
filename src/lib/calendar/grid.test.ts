import { describe, expect, it } from 'vitest';
import { buildMonthGrid, buildWeek, groupByLocalDay, shiftDate } from './grid';

describe('grelha do calendário', () => {
  it('mês começa à segunda e inclui dias dos meses vizinhos', () => {
    const g = buildMonthGrid(2026, 11);
    expect(g[0][0]).toBe('2026-10-26'); // 1/11/2026 é domingo
    expect(g.at(-1)!.at(-1)).toBe('2026-12-06');
    expect(g.every((w) => w.length === 7)).toBe(true);
  });

  it('semana de segunda a domingo', () => {
    expect(buildWeek('2026-11-04')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(buildWeek('2026-11-08')[0]).toBe('2026-11-02');
  });

  it('agrupa pelo dia local do fuso', () => {
    expect(Object.keys(groupByLocalDay([{ at: new Date('2026-11-01T23:30:00Z') }], 'Africa/Maputo'))).toEqual(['2026-11-02']);
  });

  it('shiftDate avança semanas e meses', () => {
    expect(shiftDate('2026-11-04', 'semana', 1)).toBe('2026-11-11');
    expect(shiftDate('2026-01-31', 'mes', 1)).toBe('2026-02-28');
    expect(shiftDate('2026-11-04', 'mes', -1)).toBe('2026-10-04');
  });
});
