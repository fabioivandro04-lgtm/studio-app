import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('rate limit 60/min por token', () => {
  it('61.º pedido no mesmo minuto é recusado; depois de 60 s volta a aceitar', () => {
    const take = createRateLimiter(60, 60_000);
    for (let i = 0; i < 60; i++) expect(take('t1', 1000 + i)).toBe(true);
    expect(take('t1', 2000)).toBe(false);
    expect(take('t2', 2000)).toBe(true);
    expect(take('t1', 61_000)).toBe(true);
  });
});
