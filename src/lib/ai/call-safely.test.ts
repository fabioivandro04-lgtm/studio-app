import { describe, expect, it } from 'vitest';
import { callSafely, CONNECTION_LOST } from './call-safely';

describe('callSafely', () => {
  it('devolve o resultado da ação', async () => {
    expect(await callSafely(async () => ({ ok: true as const, text: 'x' }))).toEqual({ ok: true, text: 'x' });
  });

  it('uma ação que falha (rede, tempo limite) vira erro amigável em vez de rebentar o ecrã', async () => {
    const r = await callSafely(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(r).toEqual({ ok: false, error: CONNECTION_LOST });
    expect(CONNECTION_LOST).toBe('A ligação falhou ou a IA demorou demasiado. Tente de novo.');
  });
});
