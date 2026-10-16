import { describe, expect, it } from 'vitest';
import { setupMode } from './setup-mode';

describe('setupMode', () => {
  it('cartão completo no início, linha com 1 passo em falta, escondido quando acabou ou foi fechado', () => {
    expect(setupMode(0, 4, false)).toBe('full');
    expect(setupMode(2, 4, false)).toBe('full');
    expect(setupMode(3, 4, false)).toBe('compact');
    expect(setupMode(3, 4, true)).toBe('hidden');
    expect(setupMode(4, 4, false)).toBe('hidden');
  });
});
