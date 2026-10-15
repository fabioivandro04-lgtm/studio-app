import { describe, expect, it } from 'vitest';
import { targetPatchToRow, toClaimedTarget } from './tick-repo';

describe('tick-repo mapeadores', () => {
  it('toClaimedTarget junta destino, post, conta e mídia ordenada', () => {
    const c = toClaimedTarget(
      { id: 't', post_id: 'p', social_account_id: 'a', format: 'yt_short', caption: 'c', title: 'T', options: {}, status: 'pending', progress: {}, attempts: 1 },
      { id: 'p', brand_id: 'b' },
      { id: 'a', platform: 'youtube', external_id: 'UC', access_token_enc: 'v1.a', refresh_token_enc: null, token_expires_at: '2026-10-15T11:00:00Z' },
      [
        { position: 1, media: { id: 'm2', kind: 'image', mime: 'image/jpeg', size_bytes: '20', width: 1, height: 2, duration_s: null, storage_path: 'b/2' } },
        { position: 0, media: { id: 'm1', kind: 'video', mime: 'video/mp4', size_bytes: '10', width: 1, height: 2, duration_s: '3.5', storage_path: 'b/1' } },
      ],
    );
    expect(c.brandId).toBe('b');
    expect(c.target).toMatchObject({ id: 't', postId: 'p', platform: 'youtube', attempts: 1, title: 'T' });
    expect(c.target.media.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(c.target.media[0]).toMatchObject({ sizeBytes: 10, durationS: 3.5, storagePath: 'b/1' });
    expect(c.account).toEqual({ id: 'a', externalId: 'UC', accessTokenEnc: 'v1.a', refreshTokenEnc: null, tokenExpiresAt: new Date('2026-10-15T11:00:00Z') });
  });

  it('targetPatchToRow converte nomes e datas, e omite campos ausentes', () => {
    expect(targetPatchToRow({ status: 'failed', lastError: 'x', lockedUntil: null, nextAttemptAt: new Date('2026-10-15T10:01:00Z') })).toEqual({
      status: 'failed', last_error: 'x', locked_until: null, next_attempt_at: '2026-10-15T10:01:00.000Z',
    });
  });
});
