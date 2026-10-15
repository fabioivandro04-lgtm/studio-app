import { describe, expect, it } from 'vitest';
import { localToUtc } from '@/lib/time/zone';
import { freeSlotsByDay } from './free-slots';

const TZ = 'Africa/Maputo';
const at = (d: string, t: string) => localToUtc(d, t, TZ);
// 2026-10-19 segunda (1), 2026-10-21 quarta (3)
const slots = [{ weekday: 1, time: '19:00' }, { weekday: 3, time: '12:00' }, { weekday: 3, time: '19:00' }];

describe('freeSlotsByDay', () => {
  it('horários livres por dia; ocupados e passados ficam de fora', () => {
    const r = freeSlotsByDay({ slots, tz: TZ, days: ['2026-10-19', '2026-10-20', '2026-10-21'], busy: [at('2026-10-21', '12:20')], now: at('2026-10-19', '08:00') });
    expect(r).toEqual({ '2026-10-19': ['19:00'], '2026-10-21': ['19:00'] });
    expect(freeSlotsByDay({ slots, tz: TZ, days: ['2026-10-19'], busy: [], now: at('2026-10-19', '18:30') })).toEqual({});
  });

  it('sem horários ou sem dias → vazio', () => {
    expect(freeSlotsByDay({ slots: [], tz: TZ, days: ['2026-10-19'], busy: [], now: at('2026-10-19', '08:00') })).toEqual({});
    expect(freeSlotsByDay({ slots, tz: TZ, days: [], busy: [], now: at('2026-10-19', '08:00') })).toEqual({});
  });
});
