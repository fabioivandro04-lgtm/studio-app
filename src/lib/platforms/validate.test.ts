import { describe, expect, it } from 'vitest';
import type { MediaInfo, TargetDraft } from './types';
import { validateTarget } from './validate';

let n = 0;
const m = (over: Partial<MediaInfo>): MediaInfo => ({
  id: `m${n++}`, kind: 'image', mime: 'image/jpeg', sizeBytes: 1000, width: 1080, height: 1350, durationS: null,
  storagePath: 'x', ...over,
});
const jpg = m({});
const png = m({ mime: 'image/png' });
const video = (durationS: number, width = 1080, height = 1920, mime = 'video/mp4') =>
  m({ kind: 'video', mime, durationS, width, height });
const mov30s = video(30, 1080, 1920, 'video/quicktime');
const d = (format: TargetDraft['format'], caption = '', title: string | null = null): TargetDraft => ({ format, caption, title });

describe('Instagram', () => {
  it('imagem só JPEG', () => {
    expect(validateTarget(d('ig_image'), [png])).toContainEqual({ field: 'media', message: expect.stringMatching(/JPEG/) });
    expect(validateTarget(d('ig_image'), [jpg])).toEqual([]);
  });
  it('imagem exige exatamente uma imagem', () => {
    expect(validateTarget(d('ig_image'), [jpg, jpg])).toHaveLength(1);
    expect(validateTarget(d('ig_image'), [mov30s])).toHaveLength(1);
  });
  it('carrossel entre 2 e 10 itens', () => {
    expect(validateTarget(d('ig_carousel'), [jpg])).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/2 e 10/) }));
    expect(validateTarget(d('ig_carousel'), Array(11).fill(jpg))).toHaveLength(1);
    expect(validateTarget(d('ig_carousel'), [jpg, mov30s])).toEqual([]);
  });
  it('carrossel com PNG pede JPEG', () => {
    expect(validateTarget(d('ig_carousel'), [jpg, png])).toContainEqual(expect.objectContaining({ message: expect.stringMatching(/JPEG/) }));
  });
  it('legenda até 2200 caracteres', () => {
    expect(validateTarget(d('ig_reel', 'x'.repeat(2201)), [mov30s])).toContainEqual(expect.objectContaining({ field: 'caption' }));
    expect(validateTarget(d('ig_reel', 'x'.repeat(2200)), [mov30s])).toEqual([]);
  });
  it('no máximo 30 hashtags', () => {
    expect(validateTarget(d('ig_reel', Array(31).fill('#a').join(' ')), [mov30s])).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/30 hashtags/) }),
    );
    expect(validateTarget(d('ig_reel', Array(30).fill('#a').join(' ')), [mov30s])).toEqual([]);
  });
  it('Reel entre 3 s e 15 min', () => {
    expect(validateTarget(d('ig_reel'), [video(2)])).toHaveLength(1);
    expect(validateTarget(d('ig_reel'), [video(901)])).toHaveLength(1);
    expect(validateTarget(d('ig_reel'), [jpg])).toHaveLength(1);
  });
  it('MOV aceite', () => {
    expect(validateTarget(d('ig_reel', 'ok'), [mov30s])).toEqual([]);
  });
  it('Story: vídeo até 60 s, ou imagem JPEG', () => {
    expect(validateTarget(d('ig_story'), [video(61)])).toHaveLength(1);
    expect(validateTarget(d('ig_story'), [video(60)])).toEqual([]);
    expect(validateTarget(d('ig_story'), [jpg])).toEqual([]);
  });
});

describe('TikTok', () => {
  it('exige um vídeo', () => {
    expect(validateTarget(d('tiktok_video'), [jpg])).toContainEqual(expect.objectContaining({ field: 'media' }));
  });
  it('3 s a 600 s', () => {
    expect(validateTarget(d('tiktok_video'), [video(601)])).toHaveLength(1);
    expect(validateTarget(d('tiktok_video'), [video(2)])).toHaveLength(1);
    expect(validateTarget(d('tiktok_video'), [video(600)])).toEqual([]);
  });
  it('legenda até 2200', () => {
    expect(validateTarget(d('tiktok_video', 'x'.repeat(2201)), [video(30)])).toHaveLength(1);
  });
});

describe('YouTube Shorts', () => {
  const vertical60s = video(60);
  it('título obrigatório até 100 caracteres', () => {
    expect(validateTarget(d('yt_short', '', ''), [vertical60s])).toContainEqual(expect.objectContaining({ field: 'title' }));
    expect(validateTarget(d('yt_short', '', 'x'.repeat(101)), [vertical60s])).toContainEqual(expect.objectContaining({ field: 'title' }));
  });
  it('até 180 s', () => {
    expect(validateTarget(d('yt_short', '', 't'), [video(181)])).toHaveLength(1);
    expect(validateTarget(d('yt_short', '', 't'), [video(180)])).toEqual([]);
  });
  it('vertical ou quadrado', () => {
    expect(validateTarget(d('yt_short', '', 't'), [video(60, 1920, 1080)])).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/vertical/) }),
    );
    expect(validateTarget(d('yt_short', '', 't'), [video(60, 1080, 1080)])).toEqual([]);
  });
  it('exatamente 1 vídeo', () => {
    expect(validateTarget(d('yt_short', '', 't'), [vertical60s, vertical60s])).toHaveLength(1);
  });
  it('descrição até 5000', () => {
    expect(validateTarget(d('yt_short', 'x'.repeat(5001), 't'), [vertical60s])).toContainEqual(expect.objectContaining({ field: 'caption' }));
  });
});

it('sem mídia dá erro', () => {
  expect(validateTarget(d('ig_image'), [])).toContainEqual(expect.objectContaining({ field: 'media' }));
});
