import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { probeBuffer } from './probe-server';

const fx = (f: string) => new Uint8Array(readFileSync(path.join(import.meta.dirname, '__fixtures__', f)));

describe('probeBuffer', () => {
  it('JPEG: largura e altura', () => {
    expect(probeBuffer(fx('red-40x50.jpg'), 'image/jpeg')).toEqual({ width: 40, height: 50, durationS: null });
  });
  it('MP4 com moov no fim: medidas e duração', () => {
    expect(probeBuffer(fx('blue-64x96-1.5s.mp4'), 'video/mp4')).toEqual({ width: 64, height: 96, durationS: 1.52 }) // ffprobe: 1.52 s;
  });
  it('MP4 faststart e MOV', () => {
    expect(probeBuffer(fx('faststart-64x96.mp4'), 'video/mp4')).toEqual({ width: 64, height: 96, durationS: 1.52 }) // ffprobe: 1.52 s;
    expect(probeBuffer(fx('green-96x64-2s.mov'), 'video/quicktime')).toEqual({ width: 96, height: 64, durationS: 2 });
  });
  it('lixo → nulos', () => {
    expect(probeBuffer(new Uint8Array([1, 2, 3]), 'video/mp4')).toEqual({ width: null, height: null, durationS: null });
    expect(probeBuffer(new Uint8Array([1, 2, 3]), 'image/jpeg')).toEqual({ width: null, height: null, durationS: null });
  });
});
