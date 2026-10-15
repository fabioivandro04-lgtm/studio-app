import { captionMax, isVideo, noMedia, videoDuration } from '../rules';
import type { MediaInfo, TargetDraft, ValidationError } from '../types';

export function validateTikTok(draft: TargetDraft, media: MediaInfo[]): ValidationError[] {
  const errors: ValidationError[] = [...noMedia(media)];
  if (draft.format !== 'tiktok_video') errors.push({ field: 'format', message: 'Formato não suportado no TikTok.' });
  if (media.length > 0) {
    if (media.length !== 1 || !isVideo(media[0])) errors.push({ field: 'media', message: 'O TikTok leva exatamente um vídeo.' });
    else errors.push(...videoDuration(media[0], 3, 600, 'O vídeo do TikTok'));
  }
  errors.push(...captionMax(draft.caption, 2200));
  return errors;
}
