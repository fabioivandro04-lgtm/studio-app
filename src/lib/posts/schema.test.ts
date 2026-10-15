import { describe, expect, it } from 'vitest';
import type { MediaInfo } from '@/lib/platforms/types';
import { checkPost, defaultFormat, type PostInputT } from './schema';

const NOW = new Date('2026-10-15T10:00:00Z');
const B = '11111111-1111-1111-1111-111111111111';
const IG = '22222222-2222-2222-2222-222222222222';
const TT = '33333333-3333-3333-3333-333333333333';
const M1 = '44444444-4444-4444-4444-444444444444';
const accounts = [{ id: IG, platform: 'instagram' as const }, { id: TT, platform: 'tiktok' as const }];
const video: MediaInfo = { id: M1, kind: 'video', mime: 'video/mp4', sizeBytes: 1e6, width: 1080, height: 1920, durationS: 20, storagePath: 'x' };

const input = (over: Partial<PostInputT> = {}): PostInputT => ({
  brandId: B, internalTitle: 'Prazos Portugal', mediaIds: [M1], date: '2026-11-02', time: '09:00', intent: 'schedule',
  targets: [{ accountId: IG, format: 'ig_reel', caption: 'Olá', title: null }, { accountId: TT, format: 'tiktok_video', caption: 'Olá TikTok', title: null }],
  ...over,
});

describe('checkPost', () => {
  it('converte 09:00 Maputo em 07:00Z', () => {
    const r = checkPost(input(), [video], accounts, 'Africa/Maputo', NOW);
    expect(r).toEqual({ ok: true, scheduledAt: new Date('2026-11-02T07:00:00Z') });
  });

  it('agendar com data passada → "A data já passou"', () => {
    const r = checkPost(input({ date: '2026-10-14' }), [video], accounts, 'Africa/Maputo', NOW);
    expect(r).toEqual({ ok: false, errors: [expect.objectContaining({ targetIndex: null, field: 'date', message: 'A data já passou.' })] });
  });

  it('legenda IG com 2201 caracteres → erro no destino 0, campo caption', () => {
    const r = checkPost(input({ targets: [{ accountId: IG, format: 'ig_reel', caption: 'x'.repeat(2201), title: null }] }), [video], accounts, 'Africa/Maputo', NOW);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContainEqual(expect.objectContaining({ targetIndex: 0, field: 'caption' }));
  });

  it('formato ig_reel numa conta TikTok → erro de formato', () => {
    const r = checkPost(input({ targets: [{ accountId: TT, format: 'ig_reel', caption: '', title: null }] }), [video], accounts, 'Africa/Maputo', NOW);
    expect(!r.ok && r.errors).toContainEqual(expect.objectContaining({ targetIndex: 0, field: 'format' }));
  });

  it('conta que não é da marca → erro', () => {
    const r = checkPost(input({ targets: [{ accountId: '55555555-5555-5555-5555-555555555555', format: 'ig_reel', caption: '', title: null }] }), [video], accounts, 'Africa/Maputo', NOW);
    expect(!r.ok && r.errors).toContainEqual(expect.objectContaining({ targetIndex: 0, field: 'format' }));
  });

  it('mesma conta duas vezes → erro', () => {
    const t = { accountId: IG, format: 'ig_reel' as const, caption: '', title: null };
    const r = checkPost(input({ targets: [t, t] }), [video], accounts, 'Africa/Maputo', NOW);
    expect(r.ok).toBe(false);
  });

  it('rascunho aceita destinos inválidos e data passada', () => {
    const r = checkPost(
      input({ intent: 'draft', date: '2020-01-01', targets: [{ accountId: IG, format: 'ig_reel', caption: 'x'.repeat(3000), title: null }] }),
      [video], accounts, 'Africa/Maputo', NOW,
    );
    expect(r.ok).toBe(true);
  });

  it('rascunho ainda exige esquema válido (pelo menos um destino)', () => {
    const r = checkPost(input({ intent: 'draft', targets: [] }), [video], accounts, 'Africa/Maputo', NOW);
    expect(r.ok).toBe(false);
  });
});

describe('defaultFormat', () => {
  const img = { kind: 'image' as const };
  const vid = { kind: 'video' as const };
  it('escolhe o formato pela mídia', () => {
    expect(defaultFormat('instagram', [img])).toBe('ig_image');
    expect(defaultFormat('instagram', [img, img])).toBe('ig_carousel');
    expect(defaultFormat('instagram', [vid])).toBe('ig_reel');
    expect(defaultFormat('tiktok', [vid])).toBe('tiktok_video');
    expect(defaultFormat('youtube', [vid])).toBe('yt_short');
  });
});
