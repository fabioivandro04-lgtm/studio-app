'use client';

export const UNSUPPORTED_IN_BROWSER = 'Este formato não é suportado neste browser — exporte como JPEG.';

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(UNSUPPORTED_IN_BROWSER));
    };
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível converter a imagem.'))), 'image/jpeg', quality),
  );
}

/** Lê dimensões e, se preciso, converte para JPEG (o Instagram só aceita JPEG). */
export async function prepareImage(file: File, needsJpeg: boolean): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(file);
  const { naturalWidth: width, naturalHeight: height } = img;
  URL.revokeObjectURL(img.src);
  if (!needsJpeg) return { blob: file, width, height };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // PNG transparente → fundo branco
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0);
  return { blob: await canvasToJpeg(canvas), width, height };
}

/** Lê duração e dimensões do vídeo e captura uma miniatura (fotograma a 1 s). */
export function probeVideo(file: File): Promise<{ width: number; height: number; durationS: number; thumbnail: Blob | null }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const done = (r: { width: number; height: number; durationS: number; thumbnail: Blob | null }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler este vídeo neste browser.'));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = async () => {
      const meta = { width: video.videoWidth, height: video.videoHeight, durationS: Math.round(video.duration * 100) / 100 };
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 480 / Math.max(meta.width, meta.height));
        canvas.width = Math.round(meta.width * scale);
        canvas.height = Math.round(meta.height * scale);
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        done({ ...meta, thumbnail: await canvasToJpeg(canvas, 0.8) });
      } catch {
        done({ ...meta, thumbnail: null });
      }
    };
    video.src = url;
  });
}
