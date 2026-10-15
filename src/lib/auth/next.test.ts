import { describe, expect, it } from 'vitest';
import { safeNext } from './next';

describe('safeNext (I3)', () => {
  it.each(['/calendario', '/posts/novo?data=2026-11-02', '/definicoes/contas'])('aceita %s', (p) => expect(safeNext(p)).toBe(p));
  it.each(['//evil.com', '/\\evil.com', '/\\\\evil.com/x', 'https://evil.com', 'javascript:alert(1)', '/%0d%0aX', '', null])('recusa %s', (p) => expect(safeNext(p)).toBe('/calendario'));
});
