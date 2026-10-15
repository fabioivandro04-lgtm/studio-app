import { describe, expect, it } from 'vitest';
import { formatInZone, localToUtc, nextMidnightIn, utcToLocalParts } from './zone';

describe('fusos horários', () => {
  it('Maputo 09:00 → 07:00Z', () => {
    expect(localToUtc('2026-11-02', '09:00', 'Africa/Maputo').toISOString()).toBe('2026-11-02T07:00:00.000Z');
  });

  it('Lisboa no dia da mudança para a hora de verão', () => {
    expect(localToUtc('2026-03-29', '09:00', 'Europe/Lisbon').toISOString()).toBe('2026-03-29T08:00:00.000Z');
    expect(localToUtc('2026-03-28', '09:00', 'Europe/Lisbon').toISOString()).toBe('2026-03-28T09:00:00.000Z');
  });

  it('hora inexistente avança uma hora', () => {
    expect(localToUtc('2026-03-29', '01:30', 'Europe/Lisbon').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('utcToLocalParts', () => {
    expect(utcToLocalParts(new Date('2026-11-02T07:00:00Z'), 'Africa/Maputo')).toEqual({ date: '2026-11-02', time: '09:00' });
  });

  it('formatInZone em português', () => {
    expect(formatInZone(new Date('2026-11-02T07:00:00Z'), 'Africa/Maputo', "EEEE, d 'de' MMMM")).toBe(
      'segunda-feira, 2 de novembro',
    );
  });

  it('nextMidnightIn Los Angeles', () => {
    expect(nextMidnightIn('America/Los_Angeles', new Date('2026-10-15T10:00:00Z')).toISOString()).toBe(
      '2026-10-16T07:00:00.000Z',
    );
  });

  it('formato inválido lança', () => {
    expect(() => localToUtc('02/11/2026', '9h', 'Africa/Maputo')).toThrow(/data/);
  });
});
