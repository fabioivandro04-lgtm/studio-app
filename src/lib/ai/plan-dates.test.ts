import { describe, expect, it } from 'vitest';
import { localToUtc } from '@/lib/time/zone';
import type { HistoryPoint } from './best-time';
import { deadlineDates, IDEAS_PER_RUN, missingForWeek, nextWeekRange, spreadWeek, timeForDate, weekPlanDays } from './plan-dates';

const MZ = 'Africa/Maputo';

describe('deadlineDates', () => {
  it('desvios −28…0 dias, só a partir de hoje', () => {
    expect(deadlineDates('2026-12-01', '2026-10-01')).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01']);
    expect(deadlineDates('2026-12-01', '2026-11-15')).toEqual(['2026-11-17', '2026-11-24', '2026-12-01']);
  });
  it('prazo hoje → só hoje; prazo passado → nada', () => {
    expect(deadlineDates('2026-10-15', '2026-10-15')).toEqual(['2026-10-15']);
    expect(deadlineDates('2026-10-14', '2026-10-15')).toEqual([]);
  });
});

describe('nextWeekRange', () => {
  it('segunda a domingo seguintes, no fuso da marca', () => {
    expect(nextWeekRange(localToUtc('2026-10-15', '10:00', MZ), MZ)).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
  it('numa segunda, é a semana seguinte (não a atual)', () => {
    expect(nextWeekRange(localToUtc('2026-10-19', '08:00', MZ), MZ)).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
  it('usa o dia local (Cabo Verde ainda é domingo)', () => {
    const tz = 'Atlantic/Cape_Verde';
    // 2026-10-19 00:30 UTC = domingo 18 às 23:30 em Cabo Verde
    expect(nextWeekRange(new Date('2026-10-19T00:30:00Z'), tz)).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
});

describe('spreadWeek', () => {
  it('3 → seg, qua, sex; 5 → seg, ter, qua, sex, sáb', () => {
    expect(spreadWeek('2026-10-19', 3)).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
    expect(spreadWeek('2026-10-19', 5)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24']);
  });
});

describe('missingForWeek', () => {
  it('nunca negativo', () => {
    expect(missingForWeek(3, 1)).toBe(2);
    expect(missingForWeek(3, 5)).toBe(0);
  });
});

describe('timeForDate', () => {
  const now = localToUtc('2026-10-15', '10:00', MZ);
  const base = { goal: 'contacts' as const, tz: MZ, history: [] as HistoryPoint[], busy: [] as Date[], now };

  it('sem histórico: 19:00 em dia útil, 18:00 ao sábado', () => {
    expect(timeForDate({ ...base, date: '2026-10-20' })).toBe('19:00');
    expect(timeForDate({ ...base, date: '2026-10-24' })).toBe('18:00');
  });

  it('evita posts agendados (±2 h) e horas a menos de 1 h', () => {
    expect(timeForDate({ ...base, date: '2026-10-20', busy: [localToUtc('2026-10-20', '19:30', MZ)] })).toBe('12:30');
    expect(timeForDate({ ...base, date: '2026-10-15', now: localToUtc('2026-10-15', '18:30', MZ) })).toBe('20:30');
  });

  it('com histórico usa a melhor faixa desse dia da semana', () => {
    const pt = (d: string, t: string, v: number): HistoryPoint => ({
      publishedAt: localToUtc(d, t, MZ), reach: null, views: null, profileVisits: v, follows: null, shares: null, saves: null, comments: null,
    });
    // terças às 13h com muitos contactos; restantes às 19h com poucos
    const history = [
      ...['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((d) => pt(d, '13:05', 50)),
      ...['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'].map((d) => pt(d, '19:05', 5)),
    ];
    expect(timeForDate({ ...base, date: '2026-10-20', history })).toBe('13:00');
  });
});

describe('weekPlanDays', () => {
  it('no máximo 10 ideias por pedido, espalhadas pela semana toda', () => {
    expect(IDEAS_PER_RUN).toBe(10);
    expect(weekPlanDays('2026-10-19', 3)).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
    const many = weekPlanDays('2026-10-19', 21);
    expect(many).toHaveLength(10);
    expect(many).toEqual(spreadWeek('2026-10-19', 21).slice(0, 10));
  });
});
