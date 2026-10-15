import { describe, expect, it } from 'vitest';
import { normalizeHashtag, postprocessSuggestions, RefinedSpec, SuggestionsSpec, VoiceSpec } from './schemas';
import type { Suggestions } from './types';

const base = (over: Partial<Suggestions> = {}): Suggestions => ({
  internalTitle: 'Prazos Lisboa',
  youtubeTitle: null,
  byPlatform: [{ platform: 'instagram', captions: ['a', 'b', 'c'], hashtags: ['#x'] }],
  ...over,
});

describe('normalizeHashtag', () => {
  it('junta palavras e acrescenta #', () => {
    expect(normalizeHashtag(' Estudar Fora ')).toBe('#EstudarFora');
  });
  it('remove # repetidos', () => {
    expect(normalizeHashtag('##bolsas')).toBe('#bolsas');
  });
  it('vazio → null', () => {
    expect(normalizeHashtag('#')).toBeNull();
    expect(normalizeHashtag('  ')).toBeNull();
  });
  it('mantém acentos e _', () => {
    expect(normalizeHashtag('#são_tomé')).toBe('#são_tomé');
  });
  it('remove pontuação', () => {
    expect(normalizeHashtag('#bolsas!,')).toBe('#bolsas');
  });
});

describe('postprocessSuggestions', () => {
  it('remove plataformas não pedidas e corta legendas', () => {
    const raw = base({
      byPlatform: [
        { platform: 'instagram', captions: ['x'.repeat(2300), 'b', 'c', 'd'], hashtags: [] },
        { platform: 'youtube', captions: ['y'], hashtags: [] },
      ],
    });
    const r = postprocessSuggestions(raw, { platforms: ['instagram'], fixedHashtags: [] });
    expect(r.byPlatform.map((p) => p.platform)).toEqual(['instagram']);
    expect(r.byPlatform[0].captions).toHaveLength(3);
    expect(r.byPlatform[0].captions[0]).toHaveLength(2200);
  });

  it('hashtags fixas primeiro, sem duplicados, com limite', () => {
    const raw = base({
      byPlatform: [{ platform: 'instagram', captions: ['a'], hashtags: ['#Bolsas', 'bolsas', '#Unidreamity', '#a', '#b', '#c', '#d', '#e'] }],
    });
    const r = postprocessSuggestions(raw, { platforms: ['instagram'], fixedHashtags: ['#unidreamity'] });
    expect(r.byPlatform[0].hashtags).toEqual(['#unidreamity', '#Bolsas', '#a', '#b', '#c']);
  });

  it('limite usa o nº de hashtags fixas quando é maior', () => {
    const fixed = ['#f1', '#f2', '#f3', '#f4', '#f5', '#f6'];
    const r = postprocessSuggestions(base(), { platforms: ['instagram'], fixedHashtags: fixed });
    expect(r.byPlatform[0].hashtags).toEqual(fixed);
  });

  it('YouTube: título cortado a 100; sem YouTube → null', () => {
    const raw = base({ youtubeTitle: 't'.repeat(150), byPlatform: [{ platform: 'youtube', captions: ['d'], hashtags: [] }] });
    expect(postprocessSuggestions(raw, { platforms: ['youtube'], fixedHashtags: [] }).youtubeTitle).toHaveLength(100);
    expect(postprocessSuggestions(base({ youtubeTitle: 'x' }), { platforms: ['instagram'], fixedHashtags: [] }).youtubeTitle).toBeNull();
  });

  it('remove legendas vazias e corta o título interno a 120', () => {
    const raw = base({ internalTitle: 'i'.repeat(200), byPlatform: [{ platform: 'instagram', captions: ['  ', 'ok'], hashtags: [] }] });
    const r = postprocessSuggestions(raw, { platforms: ['instagram'], fixedHashtags: [] });
    expect(r.byPlatform[0].captions).toEqual(['ok']);
    expect(r.internalTitle).toHaveLength(120);
  });
});

describe('specs', () => {
  it('SuggestionsSpec valida e recusa formas erradas', () => {
    expect(SuggestionsSpec.parse(base())).toEqual(base());
    expect(() => SuggestionsSpec.parse({ ...base(), byPlatform: [{ platform: 'instagram', captions: 'x', hashtags: [] }] })).toThrow();
    expect(() => SuggestionsSpec.parse({ ...base(), byPlatform: [{ platform: 'facebook', captions: [], hashtags: [] }] })).toThrow();
  });

  it('JSON Schema é estrito (compatível com strict: true)', () => {
    expect(SuggestionsSpec.schema).toMatchObject({ type: 'object', additionalProperties: false, required: ['internalTitle', 'youtubeTitle', 'byPlatform'] });
    expect(SuggestionsSpec.name).toBe('suggestions');
    expect(RefinedSpec.name).toBe('refined');
    expect(VoiceSpec.name).toBe('voice');
  });

  it('RefinedSpec e VoiceSpec', () => {
    expect(RefinedSpec.parse({ text: 'ok' })).toEqual({ text: 'ok' });
    expect(VoiceSpec.parse({ voice: 'v' })).toEqual({ voice: 'v' });
    expect(() => RefinedSpec.parse({})).toThrow();
  });
});
