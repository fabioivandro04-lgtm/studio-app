import { describe, expect, it } from 'vitest';
import { createFakeAi } from './fake';
import { IdeasSpec, postprocessIdeas, type IdeaDraft } from './ideas-schema';

const idea = (over: Partial<IdeaDraft> = {}): IdeaDraft => ({
  title: 'Prazos Lisboa', hook: 'Sabias que…', outline: '- ponto 1', caption: 'Legenda', format: 'ig_reel', platforms: ['instagram'], ...over,
});

describe('postprocessIdeas', () => {
  it('corta tamanhos e remove ideias sem título', () => {
    const r = postprocessIdeas({ ideas: [idea({ title: 't'.repeat(200), hook: 'h'.repeat(400), outline: 'o'.repeat(2000), caption: 'c'.repeat(3000) }), idea({ title: '  ' })] }, { count: 5, platforms: ['instagram'] });
    expect(r).toHaveLength(1);
    expect(r[0].title).toHaveLength(120);
    expect(r[0].hook).toHaveLength(300);
    expect(r[0].outline).toHaveLength(1500);
    expect(r[0].caption).toHaveLength(2200);
  });

  it('só redes disponíveis; formato de outra rede vira null', () => {
    const r = postprocessIdeas({ ideas: [idea({ platforms: ['instagram', 'tiktok'], format: 'yt_short' })] }, { count: 1, platforms: ['instagram'] });
    expect(r[0].platforms).toEqual(['instagram']);
    expect(r[0].format).toBeNull();
  });

  it('sem redes em comum usa as disponíveis', () => {
    const r = postprocessIdeas({ ideas: [idea({ platforms: ['youtube'], format: 'yt_short' })] }, { count: 1, platforms: ['instagram', 'tiktok'] });
    expect(r[0].platforms).toEqual(['instagram', 'tiktok']);
    expect(r[0].format).toBeNull();
  });

  it('limita à quantidade pedida', () => {
    expect(postprocessIdeas({ ideas: [idea(), idea(), idea()] }, { count: 2, platforms: ['instagram'] })).toHaveLength(2);
  });
});

describe('IdeasSpec', () => {
  it('estrito e valida formatos/redes', () => {
    expect(IdeasSpec.name).toBe('ideas');
    expect(IdeasSpec.schema).toMatchObject({ type: 'object', additionalProperties: false, required: ['ideas'] });
    expect(() => IdeasSpec.parse({ ideas: [idea({ format: 'banner' as never })] })).toThrow();
    expect(() => IdeasSpec.parse({ ideas: [idea({ platforms: ['facebook' as never] })] })).toThrow();
    expect(IdeasSpec.parse({ ideas: [idea({ format: null })] }).ideas[0].format).toBeNull();
  });
});

describe('fornecedor falso', () => {
  it('devolve a quantidade pedida na mensagem', async () => {
    const r = await createFakeAi().chat({ model: 'm', maxTokens: 10, spec: IdeasSpec, messages: [{ role: 'user', content: 'Quantidade: 4' }] });
    expect(r.data.ideas).toHaveLength(4);
  });
});
