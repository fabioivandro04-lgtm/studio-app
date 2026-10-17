import { describe, expect, it } from 'vitest';
import { usageOf, type UsageRow } from './usage';

const row = (o: Partial<UsageRow>): UsageRow => ({ mediaId: 'm1', postId: 'p1', title: 'T', status: 'draft', scheduledAt: null, ...o });

describe('usageOf', () => {
  it('conta posts não cancelados, um por post, mais recentes primeiro', () => {
    const u = usageOf([
      row({ postId: 'p1', scheduledAt: '2026-10-01T10:00:00Z' }),
      row({ postId: 'p1', scheduledAt: '2026-10-01T10:00:00Z' }),
      row({ postId: 'p2', status: 'published', scheduledAt: '2026-10-05T10:00:00Z' }),
      row({ postId: 'p3', status: 'cancelled' }),
      row({ mediaId: 'm2', postId: 'p4' }),
    ]);
    expect(u.get('m1')?.count).toBe(2);
    expect(u.get('m1')?.posts.map((p) => p.postId)).toEqual(['p2', 'p1']);
    expect(u.get('m2')?.count).toBe(1);
    expect(u.get('m3')).toBeUndefined();
  });

  it('ficheiro só usado em post cancelado não aparece', () => {
    expect(usageOf([row({ status: 'cancelled' })]).get('m1')).toBeUndefined();
  });

  it('posts sem data ficam no fim', () => {
    const u = usageOf([row({ postId: 'a' }), row({ postId: 'b', scheduledAt: '2026-10-05T10:00:00Z' })]);
    expect(u.get('m1')?.posts.map((p) => p.postId)).toEqual(['b', 'a']);
  });
});
