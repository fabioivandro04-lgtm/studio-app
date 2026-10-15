import { captionMax, isVideo, noMedia, videoDuration } from '../rules';
import type { MediaInfo, TargetDraft, ValidationError } from '../types';

export function validateYouTube(draft: TargetDraft, media: MediaInfo[]): ValidationError[] {
  const errors: ValidationError[] = [...noMedia(media)];
  if (draft.format !== 'yt_short') errors.push({ field: 'format', message: 'Formato não suportado no YouTube.' });
  if (media.length > 0) {
    const v = media[0];
    if (media.length !== 1 || !isVideo(v)) {
      errors.push({ field: 'media', message: 'Um Short leva exatamente um vídeo.' });
    } else {
      errors.push(...videoDuration(v, 1, 180, 'O Short'));
      if (v.width != null && v.height != null && v.height < v.width) {
        errors.push({ field: 'media', message: 'O Short tem de ser vertical ou quadrado.' });
      }
    }
  }
  const title = (draft.title ?? '').trim();
  if (!title) errors.push({ field: 'title', message: 'O título é obrigatório no YouTube.' });
  else if (title.length > 100) errors.push({ field: 'title', message: `O título tem ${title.length} caracteres; o máximo é 100.` });
  errors.push(...captionMax(draft.caption, 5000, 'A descrição'));
  return errors;
}
