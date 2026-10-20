import { describe, expect, it } from 'vitest';
import { AiSettingsInput, BrandAiInput, BrandInput, HashtagGroupInput, parseTags, TIMEZONES } from './schema';

describe('BrandInput', () => {
  it('padrão de fuso é Africa/Maputo', () => {
    expect(BrandInput.parse({ name: 'Unidreamity', color: '#0B1F45' }).timezone).toBe('Africa/Maputo');
  });
  it('rejeita nome vazio e cor inválida com mensagens em português', () => {
    const r = BrandInput.safeParse({ name: ' ', color: 'azul' });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toContain('Dê um nome à marca.');
    expect(msgs).toContain('Escolha uma cor válida.');
  });
  it('rejeita fuso fora da lista', () => {
    expect(BrandInput.safeParse({ name: 'X', color: '#000000', timezone: 'Marte/Base' }).success).toBe(false);
  });
  it('inclui os fusos dos mercados da Unidreamity', () => {
    expect(TIMEZONES.map((t) => t.id)).toEqual(expect.arrayContaining(['Africa/Maputo', 'Africa/Luanda', 'Atlantic/Cape_Verde', 'Europe/Lisbon']));
  });
});

describe('BrandAiInput', () => {
  const ok = { aiContext: 'Consultoria de candidaturas.', aiVoice: 'Próxima e confiável.', aiHashtags: ['#unidreamity', 'estudarfora'], goal: 'contacts', postsPerWeek: 3, postingSlots: [] };

  it('aceita valores válidos', () => {
    expect(BrandAiInput.parse(ok)).toEqual({ ...ok, replyKnowledge: '' });
  });

  it('recusa respostas guardadas acima de 4000', () => {
    const r = BrandAiInput.safeParse({ ...ok, replyKnowledge: 'a'.repeat(4001) });
    expect(r.error?.issues[0].message).toBe('As respostas guardadas podem ter no máximo 4000 caracteres.');
  });

  it('recusa contexto acima de 4000', () => {
    const r = BrandAiInput.safeParse({ ...ok, aiContext: 'a'.repeat(4001) });
    expect(r.error?.issues[0].message).toBe('O contexto pode ter no máximo 4000 caracteres.');
  });

  it('recusa voz acima de 2000', () => {
    const r = BrandAiInput.safeParse({ ...ok, aiVoice: 'a'.repeat(2001) });
    expect(r.error?.issues[0].message).toBe('A voz da marca pode ter no máximo 2000 caracteres.');
  });

  it('recusa mais de 10 hashtags', () => {
    const r = BrandAiInput.safeParse({ ...ok, aiHashtags: Array.from({ length: 11 }, (_, i) => `#t${i}`) });
    expect(r.error?.issues[0].message).toBe('No máximo 10 hashtags fixas.');
  });

  it('recusa hashtag com espaços ou símbolos', () => {
    expect(BrandAiInput.safeParse({ ...ok, aiHashtags: ['#a b'] }).success).toBe(false);
    expect(BrandAiInput.safeParse({ ...ok, aiHashtags: ['#são_tomé'] }).success).toBe(true);
  });

  it('posts por semana entre 1 e 21', () => {
    expect(BrandAiInput.safeParse({ ...ok, postsPerWeek: 5 }).success).toBe(true);
    for (const n of [0, 22, 2.5]) {
      expect(BrandAiInput.safeParse({ ...ok, postsPerWeek: n }).error?.issues[0].message).toBe('Entre 1 e 21 posts por semana.');
    }
  });

  it('recusa objetivo desconhecido', () => {
    expect(BrandAiInput.safeParse({ ...ok, goal: 'x' }).success).toBe(false);
  });
});

describe('AiSettingsInput', () => {
  it('aceita modelo e limite válidos', () => {
    expect(AiSettingsInput.parse({ model: 'anthropic/claude-haiku-5.5', limitUsd: 5 })).toEqual({ model: 'anthropic/claude-haiku-5.5', limitUsd: 5 });
  });

  it('limite vazio (NaN) é recusado em vez de virar 0', () => {
    const r = AiSettingsInput.safeParse({ model: 'anthropic/claude-haiku-5.5', limitUsd: Number.NaN });
    expect(r.error?.issues[0].message).toBe('Escreva um limite em USD.');
  });

  it('modelo vazio tem mensagem em pt-PT', () => {
    const r = AiSettingsInput.safeParse({ model: '', limitUsd: 5 });
    expect(r.error?.issues[0].message).toBe('Escreva o id do modelo do OpenRouter (ex.: anthropic/claude-sonnet-5.5).');
  });

  it('recusa limite negativo e modelo sem barra', () => {
    expect(AiSettingsInput.safeParse({ model: 'anthropic/claude-haiku-5.5', limitUsd: -1 }).success).toBe(false);
    expect(AiSettingsInput.safeParse({ model: 'claude', limitUsd: 5 }).success).toBe(false);
  });
});

describe('BrandAiInput — horários fixos', () => {
  const ok = { aiContext: '', aiVoice: '', aiHashtags: [], goal: 'contacts', postsPerWeek: 3 };
  it('aceita horários válidos e recusa repetidos', () => {
    expect(BrandAiInput.safeParse({ ...ok, postingSlots: [{ weekday: 1, time: '19:00' }] }).success).toBe(true);
    expect(BrandAiInput.safeParse({ ...ok, postingSlots: [{ weekday: 1, time: '19:00' }, { weekday: 1, time: '19:00' }] }).error?.issues[0].message).toBe('Horário repetido.');
  });
});

describe('grupos de hashtags', () => {
  it('parseTags: vírgulas/espaços, acrescenta #, sem repetidas', () => {
    expect(parseTags('bolsas, #Estudar  #bolsas\n#estudar')).toEqual(['#bolsas', '#Estudar']);
    expect(parseTags('  ')).toEqual([]);
  });

  it('HashtagGroupInput valida nome e hashtags', () => {
    const err = (v: Record<string, unknown>) => HashtagGroupInput.safeParse({ brandId: '6f1c2a3b-1234-4abc-8def-0123456789ab', name: 'Bolsas', tags: '#a', ...v }).error?.issues[0].message;
    expect(err({})).toBeUndefined();
    expect(err({ name: '  ' })).toBe('Dê um nome ao grupo.');
    expect(err({ name: 'x'.repeat(41) })).toBe('O nome pode ter no máximo 40 caracteres.');
    expect(err({ tags: ' , ' })).toBe('Escreva pelo menos uma hashtag.');
    expect(err({ tags: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ') })).toBe('No máximo 30 hashtags por grupo.');
    expect(err({ tags: '#ok #não-vale' })).toBe('Hashtag inválida: #não-vale');
  });
});
