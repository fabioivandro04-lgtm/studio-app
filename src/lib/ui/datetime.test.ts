import { describe, expect, it } from 'vitest';
import { formatDayPt, normalizeTime, parseDayPt, TIME_OPTIONS } from './datetime';

describe('datas e horas pt-PT', () => {
  it('formatDayPt sem deslocar o dia (sem UTC)', () => {
    expect(formatDayPt('2026-10-17')).toBe('sáb, 17 out 2026');
    expect(formatDayPt('2026-01-01')).toBe('qui, 1 jan 2026');
  });
  it('parseDayPt', () => {
    expect(parseDayPt('17/10/2026')).toBe('2026-10-17');
    expect(parseDayPt('1/2/2027')).toBe('2027-02-01');
    expect(parseDayPt('31/02/2026')).toBeNull();
    expect(parseDayPt('2026-10-17')).toBeNull();
  });
  it('normalizeTime', () => {
    expect(normalizeTime('9:30')).toBe('09:30');
    expect(normalizeTime('19:00')).toBe('19:00');
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('9:5')).toBeNull();
    expect(normalizeTime('abc')).toBeNull();
  });
  it('TIME_OPTIONS a cada 30 min', () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toBe('00:00');
    expect(TIME_OPTIONS[39]).toBe('19:30');
  });
});
