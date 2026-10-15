import { describe, expect, it } from 'vitest';
import type { RecentPost } from '@/lib/platforms/types';
import { matchTikTokUploads } from './match';

const post = (id: string, iso: string): RecentPost => ({ externalId: id, createdAt: new Date(iso), permalink: `https://t/${id}`, thumbnailUrl: null, title: null });

describe('matchTikTokUploads', () => {
  it('associa cada envio ao primeiro vídeo criado depois e ainda livre', () => {
    const r = matchTikTokUploads(
      [{ targetId: 'a', uploadedAt: new Date('2026-10-15T10:00:00Z') }, { targetId: 'b', uploadedAt: new Date('2026-10-15T11:00:00Z') }],
      [post('v3', '2026-10-15T12:00:00Z'), post('v1', '2026-10-15T10:30:00Z'), post('v2', '2026-10-15T11:30:00Z')],
      new Set(),
    );
    expect(r.map((m) => [m.targetId, m.post.externalId])).toEqual([['a', 'v1'], ['b', 'v2']]);
  });

  it('não associa vídeos criados antes do envio', () => {
    expect(matchTikTokUploads([{ targetId: 'a', uploadedAt: new Date('2026-10-15T10:00:00Z') }], [post('v0', '2026-10-15T09:00:00Z')], new Set())).toEqual([]);
  });

  it('não reutiliza vídeo já associado', () => {
    const r = matchTikTokUploads(
      [{ targetId: 'a', uploadedAt: new Date('2026-10-15T10:00:00Z') }],
      [post('v1', '2026-10-15T10:30:00Z'), post('v2', '2026-10-15T10:40:00Z')],
      new Set(['v1']),
    );
    expect(r.map((m) => m.post.externalId)).toEqual(['v2']);
  });
});
