'use client';

import * as tus from 'tus-js-client';
import { browserClient } from '@/lib/db/browser';
import { checkFile, effectiveType } from './check';
import { prepareImage, probeVideo } from './prepare';

const BUCKET = 'media';

function tusUpload(blob: Blob, path: string, contentType: string, token: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(blob, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024, // valor exigido pelo Supabase
      metadata: { bucketName: BUCKET, objectName: path, contentType, cacheControl: '3600' },
      onError: (e) => reject(new Error(`O carregamento falhou: ${e.message}`)),
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}

/** Valida, prepara e carrega um ficheiro para a marca; cria a linha em media_assets. */
export async function uploadMedia(file: File, brandId: string, maxMb: number, onProgress: (p: number) => void): Promise<string> {
  const check = checkFile(file, maxMb);
  if (!check.ok) throw new Error(check.message);
  const db = browserClient();
  const { data: session } = await db.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('A sessão expirou. Entre de novo.');

  const id = crypto.randomUUID();
  let blob: Blob = file;
  let mime = effectiveType(file);
  let width: number | null = null;
  let height: number | null = null;
  let durationS: number | null = null;
  let thumbnailPath: string | null = null;
  let ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';

  if (check.kind === 'image') {
    const img = await prepareImage(file, check.needsJpeg);
    ({ width, height } = img);
    blob = img.blob;
    if (check.needsJpeg) {
      mime = 'image/jpeg';
      ext = 'jpg';
    }
  } else {
    // Alguns vídeos (ex.: HEVC do iPhone no Chrome) não são legíveis no browser: carregar mesmo assim.
    const v = await probeVideo(file).catch(() => null);
    if (v) ({ width, height, durationS } = v);
    if (v?.thumbnail) {
      thumbnailPath = `${brandId}/${id}.thumb.jpg`;
      const { error } = await db.storage.from(BUCKET).upload(thumbnailPath, v.thumbnail, { contentType: 'image/jpeg' });
      if (error) thumbnailPath = null;
    }
  }
  if (blob.size > maxMb * 1024 * 1024) throw new Error(`Depois de convertido, "${file.name}" passa o limite de ${maxMb} MB.`);

  const path = `${brandId}/${id}.${ext}`;
  await tusUpload(blob, path, mime, token, onProgress);
  const { error } = await db.from('media_assets').insert({
    id, brand_id: brandId, storage_path: path, kind: check.kind, mime, size_bytes: blob.size,
    width, height, duration_s: durationS, thumbnail_path: thumbnailPath, original_name: file.name,
  });
  if (error) {
    await db.storage.from(BUCKET).remove([path, ...(thumbnailPath ? [thumbnailPath] : [])]);
    throw new Error('Não foi possível guardar o ficheiro na biblioteca.');
  }
  return id;
}
