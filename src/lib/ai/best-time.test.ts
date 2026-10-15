import { describe, expect, it } from 'vitest';
import { localToUtc } from '@/lib/time/zone';
import { scorePoint, suggestSlots, type HistoryPoint } from './best-time';

const MZ = 'Africa/Maputo';
const point = (at: Date, over: Partial<HistoryPoint> = {}): HistoryPoint => ({
  publishedAt: at, reach: null, views: null, profileVisits: null, follows: null, shares: null, saves: null, comments: null, ...over,
});

describe('scorePoint', () => {
  it('contactos pondera visitas, seguidores, partilhas, guardados e comentários (nulos = 0)', () => {
    expect(scorePoint(point(new Date(), { profileVisits: 3, follows: 2, shares: 1, saves: 1, comments: 4 }), 'contacts')).toBe(3 + 6 + 2 + 2 + 4);
    expect(scorePoint(point(new Date()), 'contacts')).toBe(0);
  });
  it('alcance usa reach, senão views', () => {
    expect(scorePoint(point(new Date(), { reach: 120, views: 900 }), 'reach')).toBe(120);
    expect(scorePoint(point(new Date(), { views: 900 }), 'reach')).toBe(900);
  });
});

describe('suggestSlots sem histórico', () => {
  it('3 sugestões iniciais futuras em dias diferentes', () => {
    const now = localToUtc('2026-10-15', '10:00', MZ); // quinta
    const slots = suggestSlots({ history: [], goal: 'contacts', tz: MZ, busy: [], now });
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.source === 'initial')).toBe(true);
    expect(new Set(slots.map((s) => s.date)).size).toBe(3);
    expect(slots[0]).toMatchObject({ date: '2026-10-15', time: '12:30' });
    expect(slots[0].reason).toContain('Sugestão inicial');
  });

  it('respeita o fuso da marca', () => {
    const tz = 'Atlantic/Cape_Verde';
    const now = localToUtc('2026-10-15', '10:00', tz);
    expect(suggestSlots({ history: [], goal: 'contacts', tz, busy: [], now })[0]).toMatchObject({ date: '2026-10-15', time: '12:30' });
  });

  it('não sugere menos de 1 h a partir de agora', () => {
    const now = localToUtc('2026-10-15', '12:00', MZ);
    expect(suggestSlots({ history: [], goal: 'contacts', tz: MZ, busy: [], now })[0]).toMatchObject({ date: '2026-10-15', time: '19:00' });
  });

  it('evita horas a menos de 2 h de posts agendados', () => {
    const now = localToUtc('2026-10-15', '13:00', MZ);
    const busy = [localToUtc('2026-10-15', '19:30', MZ)];
    const slots = suggestSlots({ history: [], goal: 'contacts', tz: MZ, busy, now });
    expect(slots.some((s) => s.date === '2026-10-15')).toBe(false);
    expect(slots[0]).toMatchObject({ date: '2026-10-16', time: '12:30' });
  });

  it('alcance inclui as 21:00', () => {
    const now = localToUtc('2026-10-15', '20:00', MZ);
    expect(suggestSlots({ history: [], goal: 'reach', tz: MZ, busy: [], now })[0]).toMatchObject({ date: '2026-10-15', time: '21:00' });
  });
});

describe('suggestSlots com histórico', () => {
  // 4 posts às quintas 19h com muitos contactos; 8 às segundas 12h com poucos.
  const history = [
    ...['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'].map((d) => point(localToUtc(d, '19:05', MZ), { profileVisits: 50 })),
    ...['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'].map((d) =>
      point(localToUtc(d, '12:10', MZ), { profileVisits: 5 }),
    ),
  ];
  const now = localToUtc('2026-10-13', '10:00', MZ); // terça

  it('usa as melhores faixas primeiro e explica', () => {
    const slots = suggestSlots({ history, goal: 'contacts', tz: MZ, busy: [], now });
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({ date: '2026-10-15', time: '19:00', source: 'history' });
    expect(slots[0].reason).toBe('Os teus posts de quinta às 19:00 tiveram 10× mais contactos');
    expect(slots[1]).toMatchObject({ date: '2026-10-19', time: '12:00', source: 'history' });
    expect(slots[2].source).toBe('initial');
  });

  it('menos de 10 posts → tabela inicial', () => {
    const slots = suggestSlots({ history: history.slice(0, 9), goal: 'contacts', tz: MZ, busy: [], now });
    expect(slots.every((s) => s.source === 'initial')).toBe(true);
  });

  it('todos os resultados a zero não dividem por zero', () => {
    const zeros = history.map((p) => ({ ...p, profileVisits: 0 }));
    const slots = suggestSlots({ history: zeros, goal: 'contacts', tz: MZ, busy: [], now });
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => !s.reason.includes('NaN') && !s.reason.includes('Infinity'))).toBe(true);
  });
});
