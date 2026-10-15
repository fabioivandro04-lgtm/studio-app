import { describe, expect, it } from 'vitest';
import { buildRefineMessages, buildSuggestMessages, buildVoiceMessages, PROMPT_MAX } from './prompts';
import type { BrandAi, ChatMessage, ContentPart } from './types';

const brand = (over: Partial<BrandAi> = {}): BrandAi => ({
  name: 'Unidreamity',
  aiContext: 'Consultoria de candidaturas a universidades no estrangeiro, em Maputo.',
  aiVoice: 'Próxima, confiável, sem exageros.',
  aiHashtags: ['#unidreamity'],
  goal: 'contacts',
  ...over,
});

const text = (m: ChatMessage): string =>
  typeof m.content === 'string' ? m.content : m.content.filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text').map((p) => p.text).join('\n');

describe('mensagem de sistema', () => {
  it('pede pt-PT e inclui marca, contexto, voz e hashtags fixas', () => {
    const [sys] = buildSuggestMessages({ brand: brand(), prompt: 'prazos', imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] });
    expect(sys.role).toBe('system');
    const t = text(sys);
    expect(t).toContain('português de Portugal');
    expect(t).toContain('Unidreamity');
    expect(t).toContain('Consultoria de candidaturas');
    expect(t).toContain('Próxima, confiável');
    expect(t).toContain('#unidreamity');
    expect(t).toMatch(/[Nn]unca inventes preços/);
  });

  it('marca sem contexto nem voz não inclui secções vazias', () => {
    const [sys] = buildSuggestMessages({ brand: brand({ aiContext: '', aiVoice: '  ', aiHashtags: [] }), prompt: 'x', imageUrl: null, targets: [{ platform: 'tiktok', format: 'tiktok_video' }] });
    const t = text(sys);
    expect(t).not.toContain('Contexto da empresa');
    expect(t).not.toContain('Voz da marca');
    expect(t).not.toContain('Hashtags fixas');
  });

  it('objetivo contactos vs alcance', () => {
    const c = text(buildSuggestMessages({ brand: brand(), prompt: 'x', imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] })[0]);
    const r = text(buildSuggestMessages({ brand: brand({ goal: 'reach' }), prompt: 'x', imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] })[0]);
    expect(c).toContain('contactos');
    expect(r).toContain('alcance');
  });
});

describe('buildSuggestMessages', () => {
  it('inclui a imagem quando existe', () => {
    const [, user] = buildSuggestMessages({ brand: brand(), prompt: 'prazos Lisboa', imageUrl: 'https://img/1.jpg', targets: [{ platform: 'instagram', format: 'ig_image' }] });
    expect(Array.isArray(user.content)).toBe(true);
    expect((user.content as ContentPart[]).some((p) => p.type === 'image_url' && p.image_url.url === 'https://img/1.jpg')).toBe(true);
    expect(text(user)).toContain('prazos Lisboa');
  });

  it('sem imagem não envia image_url', () => {
    const [, user] = buildSuggestMessages({ brand: brand(), prompt: 'x', imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] });
    const parts = typeof user.content === 'string' ? [] : user.content;
    expect(parts.some((p) => p.type === 'image_url')).toBe(false);
  });

  it('lista cada rede com estilo e limites; título YouTube só com YouTube', () => {
    const both = text(buildSuggestMessages({
      brand: brand(), prompt: 'x', imageUrl: null,
      targets: [{ platform: 'instagram', format: 'ig_reel' }, { platform: 'youtube', format: 'yt_short' }],
    })[1]);
    expect(both).toContain('instagram');
    expect(both).toContain('Reel');
    expect(both).toContain('gancho forte');
    expect(both).toContain('2200');
    expect(both).toMatch(/youtubeTitle[^\n]*100/);
    const igOnly = text(buildSuggestMessages({ brand: brand(), prompt: 'x', imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] })[1]);
    expect(igOnly).toMatch(/youtubeTitle[^\n]*null/);
  });

  it(`corta o pedido a ${PROMPT_MAX} caracteres`, () => {
    const [, user] = buildSuggestMessages({ brand: brand(), prompt: 'z'.repeat(500), imageUrl: null, targets: [{ platform: 'instagram', format: 'ig_image' }] });
    expect(text(user)).toContain('z'.repeat(PROMPT_MAX));
    expect(text(user)).not.toContain('z'.repeat(PROMPT_MAX + 1));
  });
});

describe('buildRefineMessages', () => {
  it('english pede tradução para inglês e mantém hashtags', () => {
    const t = text(buildRefineMessages({ brand: brand(), platform: 'instagram', text: 'Olá #bolsas', action: 'english' })[1]);
    expect(t).toContain('inglês');
    expect(t).toContain('Olá #bolsas');
    expect(t).toMatch(/[Mm]antém as hashtags/);
  });

  it('shorten pede para encurtar', () => {
    expect(text(buildRefineMessages({ brand: brand(), platform: 'tiktok', text: 'abc', action: 'shorten' })[1])).toMatch(/[Ee]ncurta/);
  });
});

describe('buildVoiceMessages', () => {
  it('numera até 20 legendas e ignora vazias', () => {
    const caps = ['', ...Array.from({ length: 25 }, (_, i) => `legenda ${i + 1}`)];
    const t = text(buildVoiceMessages({ brand: brand(), captions: caps })[1]);
    expect(t).toContain('1. legenda 1');
    expect(t).toContain('20. legenda 20');
    expect(t).not.toContain('legenda 21');
  });
});
