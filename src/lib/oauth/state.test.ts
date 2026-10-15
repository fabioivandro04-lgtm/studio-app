import { describe, expect, it } from 'vitest';
import { createOAuthState, readOAuthState } from './state';

const NOW = new Date('2026-10-15T10:00:00Z');
const SECRET = 's3gredo';
const brandId = '11111111-1111-1111-1111-111111111111';

describe('estado OAuth', () => {
  it('ida e volta', () => {
    const s = createOAuthState(brandId, 'tiktok', SECRET, NOW);
    expect(readOAuthState(s, SECRET, NOW)).toEqual({ brandId, platform: 'tiktok' });
  });

  it('adulterado → null', () => {
    const s = createOAuthState(brandId, 'tiktok', SECRET, NOW);
    const forged = s.replace('tiktok', 'youtube');
    expect(readOAuthState(forged, SECRET, NOW)).toBeNull();
  });

  it('outro segredo → null', () => {
    expect(readOAuthState(createOAuthState(brandId, 'instagram', SECRET, NOW), 'outro', NOW)).toBeNull();
  });

  it('expira ao fim de 10 minutos', () => {
    const s = createOAuthState(brandId, 'youtube', SECRET, NOW);
    expect(readOAuthState(s, SECRET, new Date(NOW.getTime() + 9 * 60_000))).not.toBeNull();
    expect(readOAuthState(s, SECRET, new Date(NOW.getTime() + 11 * 60_000))).toBeNull();
  });

  it('lixo → null', () => {
    expect(readOAuthState('abc', SECRET, NOW)).toBeNull();
    expect(readOAuthState('', SECRET, NOW)).toBeNull();
  });

  it('dois estados seguidos são diferentes', () => {
    expect(createOAuthState(brandId, 'tiktok', SECRET, NOW)).not.toBe(createOAuthState(brandId, 'tiktok', SECRET, NOW));
  });
});
