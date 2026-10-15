import { describe, expect, it } from 'vitest';
import { RefineInput, SuggestInput } from './inputs';

const id = '6f1c2a3b-1234-4abc-8def-0123456789ab';

describe('SuggestInput', () => {
  it('aceita um pedido válido', () => {
    const ok = { brandId: id, prompt: 'prazos', mediaId: null, platforms: ['instagram'], formats: { instagram: 'ig_reel' } };
    expect(SuggestInput.parse(ok)).toEqual(ok);
  });

  it('recusa rede ou formato desconhecidos', () => {
    expect(SuggestInput.safeParse({ brandId: id, prompt: 'x', mediaId: null, platforms: ['facebook'], formats: {} }).success).toBe(false);
    expect(SuggestInput.safeParse({ brandId: id, prompt: 'x', mediaId: null, platforms: ['instagram'], formats: { instagram: 'banner' } }).success).toBe(false);
  });

  it('recusa formato de outra rede', () => {
    expect(SuggestInput.safeParse({ brandId: id, prompt: 'x', mediaId: null, platforms: ['instagram'], formats: { instagram: 'yt_short' } }).success).toBe(false);
  });
});

describe('RefineInput', () => {
  it('recusa ação desconhecida com mensagem em pt-PT', () => {
    const r = RefineInput.safeParse({ brandId: id, platform: 'instagram', text: 'olá', action: 'rhyme' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe('Ação de IA desconhecida.');
  });
});
