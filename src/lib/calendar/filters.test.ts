import { describe, expect, it } from 'vitest';
import { applyFilters, filterHref, parseFilters } from './filters';

const post = (platforms: ('instagram' | 'tiktok' | 'youtube')[], status: 'draft' | 'scheduled' | 'published') => ({ platforms, status });

describe('filtros do calendário', () => {
  it('lê a URL e ignora valores inválidos', () => {
    expect(parseFilters({ rede: 'instagram,xpto', estado: 'scheduled,nada' })).toEqual({ platforms: ['instagram'], statuses: ['scheduled'] });
    expect(parseFilters({})).toEqual({ platforms: [], statuses: [] });
  });

  it('sem filtros mostra tudo; com filtros, rede E estado', () => {
    const ps = [post(['instagram'], 'draft'), post(['tiktok', 'youtube'], 'scheduled'), post(['instagram'], 'published')];
    expect(applyFilters(ps, { platforms: [], statuses: [] })).toHaveLength(3);
    expect(applyFilters(ps, { platforms: ['instagram'], statuses: [] })).toHaveLength(2);
    expect(applyFilters(ps, { platforms: ['instagram'], statuses: ['published'] })).toEqual([ps[2]]);
  });

  it('link liga/desliga um valor e mantém os outros parâmetros', () => {
    const f = { platforms: ['instagram' as const], statuses: [] };
    expect(filterHref({ vista: 'mes', data: '2026-10-19' }, f, 'rede', 'tiktok')).toBe('/calendario?vista=mes&data=2026-10-19&rede=instagram%2Ctiktok');
    expect(filterHref({ vista: 'mes' }, f, 'rede', 'instagram')).toBe('/calendario?vista=mes');
  });
});
