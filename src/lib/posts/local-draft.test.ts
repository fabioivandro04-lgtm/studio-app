import { describe, expect, it } from 'vitest';
import { clearLocalDraft, localDraftKey, readLocalDraft, writeLocalDraft } from './local-draft';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const base = { brandId: 'b', internalTitle: 'T', mediaIds: [], date: '2026-10-19', time: '19:00', targets: [], locked: false };
const NOW = Date.parse('2026-10-18T10:00:00Z');

describe('rascunho local', () => {
  it('chave por post; post novo tem chave própria', () => {
    expect(localDraftKey('p1')).toBe('estudio:rascunho:p1');
    expect(localDraftKey(null)).toBe('estudio:rascunho:novo');
  });

  it('devolve o rascunho guardado se for diferente do que está no servidor', () => {
    const s = memory();
    writeLocalDraft(s, 'k', { ...base, internalTitle: 'Mudado' }, NOW);
    expect(readLocalDraft(s, 'k', base, NOW + 60_000)).toEqual({ savedAt: NOW, value: { ...base, internalTitle: 'Mudado' } });
  });

  it('ignora rascunho igual ao guardado, estragado ou com mais de 7 dias', () => {
    const s = memory();
    writeLocalDraft(s, 'k', base, NOW);
    expect(readLocalDraft(s, 'k', base, NOW)).toBeNull();
    s.setItem('k', '{estragado');
    expect(readLocalDraft(s, 'k', base, NOW)).toBeNull();
    writeLocalDraft(s, 'k', { ...base, internalTitle: 'Velho' }, NOW);
    expect(readLocalDraft(s, 'k', base, NOW + 8 * 86_400_000)).toBeNull();
  });

  it('limpa ao guardar', () => {
    const s = memory();
    writeLocalDraft(s, 'k', { ...base, internalTitle: 'X' }, NOW);
    clearLocalDraft(s, 'k');
    expect(s.m.size).toBe(0);
  });
});
