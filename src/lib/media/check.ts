export type CheckResult = { ok: true; kind: 'image' | 'video'; needsJpeg: boolean } | { ok: false; message: string };

const IMAGE_CONVERT = new Set(['image/png', 'image/webp', 'image/heic', 'image/heif']);
const VIDEO = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const EXT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

/** Tipo MIME efetivo: alguns browsers deixam HEIC/MOV sem tipo. */
export function effectiveType(file: { name: string; type: string }): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TYPE[ext] ?? '';
}

/** Verifica um ficheiro antes de o carregar. Puro — corre no browser. */
export function checkFile(file: { name: string; type: string; size: number }, maxMb: number): CheckResult {
  if (file.size <= 0) return { ok: false, message: `"${file.name}" está vazio.` };
  if (file.size > maxMb * 1024 * 1024) {
    return { ok: false, message: `"${file.name}" tem ${(file.size / 1024 / 1024).toFixed(0)} MB; o limite é ${maxMb} MB.` };
  }
  const type = effectiveType(file);
  if (type === 'image/jpeg') return { ok: true, kind: 'image', needsJpeg: false };
  if (IMAGE_CONVERT.has(type)) return { ok: true, kind: 'image', needsJpeg: true };
  if (VIDEO.has(type)) return { ok: true, kind: 'video', needsJpeg: false };
  return { ok: false, message: `"${file.name}": formato não suportado. Use JPEG, PNG, HEIC, MP4 ou MOV.` };
}
