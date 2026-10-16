import { describe, expect, it } from 'vitest';
import { checkRange, localDayRange } from './common';

describe('checkRange', () => {
  it('aceita até ao máximo de dias e recusa intervalos invertidos ou longos', () => {
    expect(() => checkRange('2026-10-01', '2026-12-01', 62)).not.toThrow();
    expect(() => checkRange('2026-10-01', '2026-12-03', 62)).toThrow('Escolha no máximo 62 dias.');
    expect(() => checkRange('2026-10-05', '2026-10-01', 62)).toThrow('A data final tem de ser igual ou depois da inicial.');
  });
});

describe('localDayRange', () => {
  it('do início do primeiro dia ao fim do último, no fuso da marca', () => {
    const r = localDayRange('2026-10-20', '2026-10-21', 'Africa/Maputo');
    expect(r.from.toISOString()).toBe('2026-10-19T22:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-21T22:00:00.000Z');
  });
});
