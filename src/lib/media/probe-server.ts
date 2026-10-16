/** Medidas e duração lidas dos cabeçalhos do ficheiro, no servidor (sem browser nem ffmpeg). */
export interface Probe { width: number | null; height: number | null; durationS: number | null }

const NONE: Probe = { width: null, height: null, durationS: null };

function probeJpeg(b: Uint8Array): Probe {
  if (b[0] !== 0xff || b[1] !== 0xd8) return NONE;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return NONE;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = v.getUint16(i + 2);
    // SOF0..SOF15, exceto DHT (C4), JPG (C8) e DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: v.getUint16(i + 7), height: v.getUint16(i + 5), durationS: null };
    }
    i += 2 + len;
  }
  return NONE;
}

interface Box { type: string; start: number; end: number }

function boxes(v: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  let i = start;
  while (i + 8 <= end) {
    let size = v.getUint32(i);
    const type = String.fromCharCode(v.getUint8(i + 4), v.getUint8(i + 5), v.getUint8(i + 6), v.getUint8(i + 7));
    let header = 8;
    if (size === 1) {
      if (i + 16 > end) break;
      size = Number(v.getBigUint64(i + 8));
      header = 16;
    } else if (size === 0) size = end - i;
    if (size < header || i + size > end) break;
    out.push({ type, start: i + header, end: i + size });
    i += size;
  }
  return out;
}

const child = (v: DataView, b: Box, type: string) => boxes(v, b.start, b.end).find((x) => x.type === type);

function probeMp4(b: Uint8Array): Probe {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const moov = boxes(v, 0, b.length).find((x) => x.type === 'moov');
  if (!moov) return NONE;
  let durationS: number | null = null;
  const mvhd = child(v, moov, 'mvhd');
  if (mvhd) {
    const version = v.getUint8(mvhd.start);
    const timescale = version === 1 ? v.getUint32(mvhd.start + 20) : v.getUint32(mvhd.start + 12);
    const duration = version === 1 ? Number(v.getBigUint64(mvhd.start + 24)) : v.getUint32(mvhd.start + 16);
    if (timescale > 0) durationS = Math.round((duration / timescale) * 100) / 100;
  }
  for (const trak of boxes(v, moov.start, moov.end).filter((x) => x.type === 'trak')) {
    const mdia = child(v, trak, 'mdia');
    const hdlr = mdia && child(v, mdia, 'hdlr');
    const handler = hdlr ? String.fromCharCode(...b.slice(hdlr.start + 8, hdlr.start + 12)) : '';
    const tkhd = child(v, trak, 'tkhd');
    if (handler === 'vide' && tkhd && tkhd.end - tkhd.start >= 84) {
      return { width: Math.round(v.getUint32(tkhd.end - 8) / 65536), height: Math.round(v.getUint32(tkhd.end - 4) / 65536), durationS };
    }
  }
  return { ...NONE, durationS };
}

export function probeBuffer(buf: Uint8Array, mime: string): Probe {
  try {
    if (mime === 'image/jpeg') return probeJpeg(buf);
    if (mime === 'video/mp4' || mime === 'video/quicktime') return probeMp4(buf);
  } catch {}
  return NONE;
}
