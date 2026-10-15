import type { Platform } from '@/lib/platforms/types';

/** Regras de escrita por rede, usadas nos prompts e no pós-processamento. */
export const AI_RULES: Record<Platform, { captionMax: number; hashtagsMin: number; hashtagsMax: number; style: string }> = {
  instagram: {
    captionMax: 2200,
    hashtagsMin: 3,
    hashtagsMax: 5,
    style: 'gancho forte na 1.ª linha, parágrafos curtos, emojis com moderação',
  },
  tiktok: {
    captionMax: 2200,
    hashtagsMin: 3,
    hashtagsMax: 5,
    style: 'curta, 1–2 frases, direta',
  },
  youtube: {
    captionMax: 5000,
    hashtagsMin: 3,
    hashtagsMax: 3,
    style: 'descrição com a palavra-chave principal no início',
  },
};

export const YT_TITLE_MAX = 100;
export const INTERNAL_TITLE_MAX = 120;
