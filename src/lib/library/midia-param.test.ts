import { describe, expect, it } from 'vitest';
import { parseMidia, pickPrefilled } from './midia-param';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('parseMidia', () => {
  it('lista separada por vírgulas, sem repetidos nem inválidos, ordem mantida', () => {
    expect(parseMidia(`${B},${A},xx,${B}, ${C}`)).toEqual([B, A, C]);
  });
  it('vazio ou ausente', () => {
    expect(parseMidia(undefined)).toEqual([]);
    expect(parseMidia('')).toEqual([]);
  });
  it('no máximo 20', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);
    expect(parseMidia(ids.join(','))).toHaveLength(20);
  });
});

describe('pickPrefilled', () => {
  const media = [{ id: A, brandId: 'b1' }, { id: B, brandId: 'b1' }, { id: C, brandId: 'b2' }];
  it('usa a marca do primeiro ficheiro e ignora os de outra marca e os que não existem', () => {
    expect(pickPrefilled([B, 'zz', C, A], media)).toEqual({ brandId: 'b1', mediaIds: [B, A] });
  });
  it('sem ficheiros válidos', () => {
    expect(pickPrefilled(['zz'], media)).toEqual({ brandId: null, mediaIds: [] });
  });
});
