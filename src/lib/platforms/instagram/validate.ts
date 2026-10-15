import { captionMax, isJpeg, isVideo, noMedia, videoDuration } from '../rules';
import type { MediaInfo, TargetDraft, ValidationError } from '../types';

const JPEG_MSG = 'O Instagram só aceita imagens JPEG. Converta a imagem para JPEG.';

export function validateInstagram(draft: TargetDraft, media: MediaInfo[]): ValidationError[] {
  const errors: ValidationError[] = [...noMedia(media)];
  if (media.length === 0) return errors;

  switch (draft.format) {
    case 'ig_image':
      if (media.length !== 1 || isVideo(media[0])) errors.push({ field: 'media', message: 'Uma publicação de imagem leva exatamente uma imagem.' });
      else if (!isJpeg(media[0])) errors.push({ field: 'media', message: JPEG_MSG });
      break;
    case 'ig_carousel':
      if (media.length < 2 || media.length > 10) errors.push({ field: 'media', message: 'Um carrossel tem entre 2 e 10 itens.' });
      if (media.some((m) => !isVideo(m) && !isJpeg(m))) errors.push({ field: 'media', message: JPEG_MSG });
      break;
    case 'ig_reel':
      if (media.length !== 1 || !isVideo(media[0])) errors.push({ field: 'media', message: 'Um Reel leva exatamente um vídeo.' });
      else errors.push(...videoDuration(media[0], 3, 15 * 60, 'O Reel'));
      break;
    case 'ig_story':
      if (media.length !== 1) errors.push({ field: 'media', message: 'Uma Story leva exatamente um ficheiro.' });
      else if (isVideo(media[0])) errors.push(...videoDuration(media[0], 1, 60, 'O vídeo da Story'));
      else if (!isJpeg(media[0])) errors.push({ field: 'media', message: JPEG_MSG });
      break;
    default:
      errors.push({ field: 'format', message: 'Formato não suportado no Instagram.' });
  }

  if (draft.format !== 'ig_story') {
    errors.push(...captionMax(draft.caption, 2200));
    const hashtags = draft.caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (hashtags.length > 30) {
      errors.push({ field: 'caption', message: `A legenda tem ${hashtags.length} hashtags; o Instagram permite no máximo 30 hashtags.` });
    }
  }
  return errors;
}
