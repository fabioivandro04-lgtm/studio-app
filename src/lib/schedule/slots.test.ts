import { describe, expect, it } from 'vitest';
import { localToUtc } from '@/lib/time/zone';
import { freeSlotsInRange, isTaken, nextFreeSlot, PostingSlots, slotDates } from './slots';

const TZ = 'Africa/Maputo';
// 2026-10-19 é segunda-feira (weekday 1); 0 = domingo.
const MWF = [{ weekday: 1, time: '19:00' }, { weekday: 3, time: '19:00' }, { weekday: 5, time: '12:00' }, { weekday: 5, time: '09:00' }];
const at = (date: string, time: string, tz = TZ) => localToUtc(date, time, tz);

describe('slotDates', () => {
  it('dias com horário, ordenados por data e hora', () => {
    expect(slotDates({ slots: MWF, from: '2026-10-19', to: '2026-10-23' })).toEqual([
      { date: '2026-10-19', time: '19:00' }, { date: '2026-10-21', time: '19:00' }, { date: '2026-10-23', time: '09:00' }, { date: '2026-10-23', time: '12:00' },
    ]);
  });
});

describe('isTaken', () => {
  it('ocupado a menos de 1 h; a 60 min já está livre', () => {
    const t = at('2026-10-19', '19:00');
    expect(isTaken(t, [at('2026-10-19', '19:59')])).toBe(true);
    expect(isTaken(t, [at('2026-10-19', '20:00')])).toBe(false);
  });
});

describe('nextFreeSlot', () => {
  it('hoje já passou (ou a < 1 h) → salta para o seguinte', () => {
    const now = at('2026-10-19', '18:30');
    expect(nextFreeSlot({ slots: MWF, tz: TZ, busy: [], now })).toEqual({ date: '2026-10-21', time: '19:00' });
    expect(nextFreeSlot({ slots: MWF, tz: TZ, busy: [], now: at('2026-10-19', '17:59') })).toEqual({ date: '2026-10-19', time: '19:00' });
  });

  it('salta horários ocupados', () => {
    const now = at('2026-10-19', '08:00');
    expect(nextFreeSlot({ slots: MWF, tz: TZ, busy: [at('2026-10-19', '19:30')], now })).toEqual({ date: '2026-10-21', time: '19:00' });
  });

  it('fuso de Cabo Verde', () => {
    const tz = 'Atlantic/Cape_Verde';
    const r = nextFreeSlot({ slots: [{ weekday: 1, time: '19:00' }], tz, busy: [], now: at('2026-10-18', '12:00', tz) });
    expect(r).toEqual({ date: '2026-10-19', time: '19:00' });
  });

  it('sem horários ou tudo ocupado no horizonte → null', () => {
    const now = at('2026-10-19', '08:00');
    expect(nextFreeSlot({ slots: [], tz: TZ, busy: [], now })).toBeNull();
    const busy = slotDates({ slots: [{ weekday: 1, time: '19:00' }], from: '2026-10-19', to: '2026-11-30' }).map((s) => at(s.date, s.time));
    expect(nextFreeSlot({ slots: [{ weekday: 1, time: '19:00' }], tz: TZ, busy, now, horizonDays: 28 })).toBeNull();
  });
});

describe('freeSlotsInRange', () => {
  it('só os livres e futuros dentro do intervalo', () => {
    const r = freeSlotsInRange({ slots: MWF, tz: TZ, busy: [at('2026-10-21', '19:00')], now: at('2026-10-19', '20:00'), from: '2026-10-19', to: '2026-10-25' });
    expect(r).toEqual([{ date: '2026-10-23', time: '09:00' }, { date: '2026-10-23', time: '12:00' }]);
  });
});

describe('PostingSlots (zod)', () => {
  const err = (v: unknown) => { const r = PostingSlots.safeParse(v); return r.success ? null : r.error.issues[0].message; };
  it('aceita lista válida; recusa repetidos, hora inválida e mais de 21', () => {
    expect(err(MWF)).toBeNull();
    expect(err([{ weekday: 1, time: '19:00' }, { weekday: 1, time: '19:00' }])).toBe('Horário repetido.');
    expect(err([{ weekday: 1, time: '24:00' }])).toBe('Hora inválida.');
    expect(err([{ weekday: 7, time: '10:00' }])).toBe('Dia da semana inválido.');
    expect(err(Array.from({ length: 22 }, (_, i) => ({ weekday: i % 7, time: `${String(i).padStart(2, '0')}:00` })))).toBe('No máximo 21 horários.');
  });
});
