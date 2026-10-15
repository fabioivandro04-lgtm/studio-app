import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './tokens';

const key = Buffer.alloc(32, 1).toString('base64');
const otherKey = Buffer.alloc(32, 2).toString('base64');

describe('tokens', () => {
  it('ida e volta devolve o original', () => {
    expect(decryptToken(encryptToken('IGQVJ-segredo', key), key)).toBe('IGQVJ-segredo');
  });

  it('duas encriptações do mesmo texto diferem', () => {
    expect(encryptToken('abc', key)).not.toBe(encryptToken('abc', key));
  });

  it('formato v1.<iv>.<dados>', () => {
    expect(encryptToken('abc', key)).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('chave errada lança', () => {
    expect(() => decryptToken(encryptToken('abc', key), otherKey)).toThrow();
  });

  it('texto adulterado lança', () => {
    const enc = encryptToken('abc', key);
    const last = enc.at(-1) === 'A' ? 'B' : 'A';
    expect(() => decryptToken(enc.slice(0, -1) + last, key)).toThrow();
  });

  it('prefixo desconhecido lança erro de formato', () => {
    expect(() => decryptToken('v2.aaa.bbb', key)).toThrow(/formato/);
  });
});
