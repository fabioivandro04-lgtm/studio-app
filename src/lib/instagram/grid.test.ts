import { describe, expect, it } from 'vitest';
import { buildGrid } from './grid';

const planned = (id: string, at: string, status: 'draft' | 'scheduled' = 'scheduled') => ({ id, at: new Date(at), status, thumbUrl: null, title: id, format: 'ig_image' as const });
const pub = (id: string, at: string) => ({ externalId: id, createdAt: new Date(at), permalink: `https://ig/${id}`, thumbnailUrl: `https://cdn/${id}.jpg`, title: null });

describe('buildGrid', () => {
  it('planeados primeiro (o mais distante no topo), depois publicados do mais recente', () => {
    const g = buildGrid([planned('a', '2026-10-20T10:00:00Z'), planned('b', '2026-10-25T10:00:00Z', 'draft')], [pub('x', '2026-10-01T10:00:00Z'), pub('y', '2026-10-10T10:00:00Z')]);
    expect(g.map((i) => i.key)).toEqual(['plan:b', 'plan:a', 'ig:y', 'ig:x']);
    expect(g[0]).toMatchObject({ kind: 'planned', href: '/posts/b', status: 'draft' });
    expect(g[2]).toMatchObject({ kind: 'published', href: 'https://ig/y', thumbUrl: 'https://cdn/y.jpg' });
  });

  it('limita os publicados a 24 (8 filas)', () => {
    const many = Array.from({ length: 30 }, (_, i) => pub(`p${i}`, new Date(Date.UTC(2026, 8, i + 1)).toISOString()));
    expect(buildGrid([], many).length).toBe(24);
  });
});
