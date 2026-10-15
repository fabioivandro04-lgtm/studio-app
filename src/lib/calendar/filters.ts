import type { Platform, PostStatus } from '@/lib/platforms/types';

export const FILTER_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube'];
export const FILTER_STATUSES: PostStatus[] = ['draft', 'scheduled', 'needs_action', 'published', 'failed'];
const ALL_STATUSES: PostStatus[] = ['draft', 'scheduled', 'publishing', 'needs_action', 'published', 'partial', 'failed', 'cancelled'];

export interface CalendarFilters { platforms: Platform[]; statuses: PostStatus[] }

const list = <T extends string>(raw: string | undefined, allowed: readonly T[]): T[] =>
  [...new Set((raw ?? '').split(',').filter((v): v is T => (allowed as readonly string[]).includes(v)))];

/** Filtros da URL (?rede=instagram,tiktok&estado=scheduled); valores desconhecidos são ignorados. */
export function parseFilters(sp: { rede?: string; estado?: string }): CalendarFilters {
  return { platforms: list(sp.rede, FILTER_PLATFORMS), statuses: list(sp.estado, ALL_STATUSES) };
}

export function applyFilters<T extends { platforms: Platform[]; status: PostStatus }>(posts: T[], f: CalendarFilters): T[] {
  return posts.filter(
    (p) => (f.platforms.length === 0 || p.platforms.some((x) => f.platforms.includes(x))) && (f.statuses.length === 0 || f.statuses.includes(p.status)),
  );
}

/** Link que liga/desliga um valor do filtro, mantendo a vista e a data. */
export function filterHref(base: { vista?: string; data?: string }, f: CalendarFilters, key: 'rede' | 'estado', value: string): string {
  const cur: string[] = key === 'rede' ? f.platforms : f.statuses;
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  const q = new URLSearchParams();
  if (base.vista) q.set('vista', base.vista);
  if (base.data) q.set('data', base.data);
  const rede = key === 'rede' ? next : f.platforms;
  const estado = key === 'estado' ? next : f.statuses;
  if (rede.length) q.set('rede', rede.join(','));
  if (estado.length) q.set('estado', estado.join(','));
  const qs = q.toString();
  return qs ? `/calendario?${qs}` : '/calendario';
}
