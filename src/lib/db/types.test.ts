import { describe, expect, it } from 'vitest';
import { fromPostTargetRow, fromMediaRow } from './types';

describe('mapeadores', () => {
  it('fromPostTargetRow converte datas e nomes', () => {
    const t = fromPostTargetRow({
      id: 't1', post_id: 'p1', social_account_id: 'a1', format: 'ig_reel', caption: 'c', title: null,
      options: {}, status: 'processing', progress: { step: 'container' }, attempts: 2,
      next_attempt_at: '2026-10-15T10:00:00Z', locked_until: null, external_post_id: null, permalink: null,
      last_error: null, published_at: null, updated_at: '2026-10-15T09:00:00Z',
    });
    expect(t.socialAccountId).toBe('a1');
    expect(t.nextAttemptAt?.toISOString()).toBe('2026-10-15T10:00:00.000Z');
    expect(t.progress).toEqual({ step: 'container' });
    expect(t.publishedAt).toBeNull();
  });

  it('fromMediaRow converte duração numérica em número', () => {
    const m = fromMediaRow({
      id: 'm', brand_id: 'b', storage_path: 'b/m.mp4', kind: 'video', mime: 'video/mp4', size_bytes: '1048576',
      width: 1080, height: 1920, duration_s: '12.50', thumbnail_path: null, original_name: 'a.mp4', tags: [],
      created_at: '2026-10-15T09:00:00Z',
    });
    expect(m.sizeBytes).toBe(1048576);
    expect(m.durationS).toBe(12.5);
  });
});
