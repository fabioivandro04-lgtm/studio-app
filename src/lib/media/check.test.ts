import { describe, expect, it } from 'vitest';
import { checkFile } from './check';

describe('checkFile', () => {
  it('PNG é aceite e precisa de conversão para JPEG', () => {
    expect(checkFile({ name: 'a.png', type: 'image/png', size: 1e6 }, 50)).toEqual({ ok: true, kind: 'image', needsJpeg: true });
  });
  it('JPEG não precisa de conversão', () => {
    expect(checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 1e6 }, 50)).toEqual({ ok: true, kind: 'image', needsJpeg: false });
  });
  it('HEIC do iPhone é aceite e precisa de conversão', () => {
    expect(checkFile({ name: 'IMG_1.HEIC', type: 'image/heic', size: 1e6 }, 50)).toEqual({ ok: true, kind: 'image', needsJpeg: true });
  });
  it('HEIC sem tipo MIME (alguns browsers) é reconhecido pela extensão', () => {
    expect(checkFile({ name: 'IMG_1.heic', type: '', size: 1e6 }, 50)).toEqual({ ok: true, kind: 'image', needsJpeg: true });
  });
  it('MOV do iPhone é aceite', () => {
    expect(checkFile({ name: 'b.mov', type: 'video/quicktime', size: 1e6 }, 50)).toEqual({ ok: true, kind: 'video', needsJpeg: false });
  });
  it('MP4 é aceite', () => {
    expect(checkFile({ name: 'c.mp4', type: 'video/mp4', size: 1e6 }, 50)).toMatchObject({ ok: true, kind: 'video' });
  });
  it('acima do limite → mensagem com o limite', () => {
    expect(checkFile({ name: 'c.mp4', type: 'video/mp4', size: 51 * 1024 * 1024 }, 50)).toEqual({
      ok: false, message: expect.stringMatching(/50 MB/),
    });
  });
  it('GIF e outros formatos são recusados', () => {
    expect(checkFile({ name: 'd.gif', type: 'image/gif', size: 1e3 }, 50)).toMatchObject({ ok: false });
    expect(checkFile({ name: 'e.pdf', type: 'application/pdf', size: 1e3 }, 50)).toMatchObject({ ok: false });
  });
  it('ficheiro vazio é recusado', () => {
    expect(checkFile({ name: 'f.jpg', type: 'image/jpeg', size: 0 }, 50)).toMatchObject({ ok: false });
  });
});
