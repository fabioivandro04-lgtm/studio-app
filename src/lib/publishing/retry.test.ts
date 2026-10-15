import { describe, expect, it } from 'vitest';
import { nextRetryAt, PROCESSING_TIMEOUT_MIN, RETRY_DELAYS_MIN } from './retry';

const now = new Date('2026-10-15T10:00:00Z');

describe('nextRetryAt', () => {
  it('espera 1, 5 e 15 minutos', () => {
    expect(nextRetryAt(1, now)?.toISOString()).toBe('2026-10-15T10:01:00.000Z');
    expect(nextRetryAt(2, now)?.toISOString()).toBe('2026-10-15T10:05:00.000Z');
    expect(nextRetryAt(3, now)?.toISOString()).toBe('2026-10-15T10:15:00.000Z');
  });

  it('à 4.ª falha desiste', () => {
    expect(nextRetryAt(4, now)).toBeNull();
  });

  it('constantes da spec', () => {
    expect(RETRY_DELAYS_MIN).toEqual([1, 5, 15]);
    expect(PROCESSING_TIMEOUT_MIN).toBe(30);
  });
});
