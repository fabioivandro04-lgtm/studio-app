import { validateInstagram } from './instagram/validate';
import { validateTikTok } from './tiktok/validate';
import { FORMAT_PLATFORM, type MediaInfo, type Platform, type TargetDraft, type ValidationError } from './types';
import { validateYouTube } from './youtube/validate';

export const VALIDATORS: Record<Platform, (d: TargetDraft, m: MediaInfo[]) => ValidationError[]> = {
  instagram: validateInstagram,
  tiktok: validateTikTok,
  youtube: validateYouTube,
};

/** Valida um destino com as regras da rede do seu formato. Puro — usado no servidor e no browser. */
export function validateTarget(draft: TargetDraft, media: MediaInfo[]): ValidationError[] {
  return VALIDATORS[FORMAT_PLATFORM[draft.format]](draft, media);
}
