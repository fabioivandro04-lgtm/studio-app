import { describe, expect, it } from 'vitest';
import { assertWithinBudget, monthStartUtc } from './budget';
import { AiError } from './errors';

describe('monthStartUtc', () => {
  it('início do mês em UTC', () => {
    expect(monthStartUtc(new Date('2026-10-15T23:30:00-01:00'))).toBe('2026-10-01T00:00:00.000Z');
  });
  it('usa o mês UTC mesmo quando o fuso local já mudou de mês', () => {
    expect(monthStartUtc(new Date('2026-11-01T00:30:00+02:00'))).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('assertWithinBudget', () => {
  it('abaixo do limite não lança', () => {
    expect(() => assertWithinBudget(4.99, 5)).not.toThrow();
  });
  it('no limite lança budget com o valor', () => {
    let err: unknown;
    try {
      assertWithinBudget(5, 5);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).code).toBe('budget');
    expect((err as AiError).message).toBe('Chegou ao limite mensal de IA (5 USD). Aumente em Definições → IA.');
  });
  it('limite 0 bloqueia sempre', () => {
    expect(() => assertWithinBudget(0, 0)).toThrow(/limite mensal/);
  });
  it('limite com decimais aparece formatado', () => {
    expect(() => assertWithinBudget(3, 2.5)).toThrow('(2.5 USD)');
  });
});
