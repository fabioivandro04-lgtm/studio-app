import { z } from 'zod';
import type { Platform } from '@/lib/platforms/types';
import { AI_RULES, INTERNAL_TITLE_MAX, YT_TITLE_MAX } from './rules';
import type { JsonSchemaSpec, Suggestions } from './types';

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;

const SuggestionsZ = z.object({
  internalTitle: z.string(),
  youtubeTitle: z.string().nullable(),
  byPlatform: z.array(
    z.object({ platform: z.enum(PLATFORMS), captions: z.array(z.string()), hashtags: z.array(z.string()) }),
  ),
});

const str = { type: 'string' };
const strArr = { type: 'array', items: str };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

export const SuggestionsSpec: JsonSchemaSpec<Suggestions> = {
  name: 'suggestions',
  schema: obj({
    internalTitle: str,
    youtubeTitle: { type: ['string', 'null'] },
    byPlatform: { type: 'array', items: obj({ platform: { type: 'string', enum: [...PLATFORMS] }, captions: strArr, hashtags: strArr }) },
  }),
  parse: (x) => SuggestionsZ.parse(x),
};

const RefinedZ = z.object({ text: z.string() });
export const RefinedSpec: JsonSchemaSpec<{ text: string }> = {
  name: 'refined',
  schema: obj({ text: str }),
  parse: (x) => RefinedZ.parse(x),
};

const VoiceZ = z.object({ voice: z.string() });
export const VoiceSpec: JsonSchemaSpec<{ voice: string }> = {
  name: 'voice',
  schema: obj({ voice: str }),
  parse: (x) => VoiceZ.parse(x),
};

/** "#Estudar Fora!" → "#EstudarFora"; null quando não sobra nada. */
export function normalizeHashtag(s: string): string | null {
  const body = s.replace(/[^\p{L}\p{N}_]/gu, '');
  return body ? `#${body}` : null;
}

/** "#bolsas #estudar" ou "#a#b" → várias hashtags; uma frase sem # continua a ser uma só. */
function splitHashtags(s: string): string[] {
  return (s.match(/#/g)?.length ?? 0) > 1 ? s.split('#').filter((x) => x.trim()) : [s];
}

/** Limita, normaliza e filtra a resposta da IA às redes pedidas (redes sem resposta ficam vazias). */
export function postprocessSuggestions(raw: Suggestions, o: { platforms: Platform[]; fixedHashtags: string[] }): Suggestions {
  const fixed = o.fixedHashtags.map(normalizeHashtag).filter((h): h is string => !!h);
  const byPlatform = o.platforms
    .filter((p, i, all) => all.indexOf(p) === i)
    .map((platform) => raw.byPlatform.find((q) => q.platform === platform) ?? { platform, captions: [], hashtags: [] })
    .map((p) => {
      const rules = AI_RULES[p.platform];
      const seen = new Set<string>();
      const hashtags = [...fixed, ...p.hashtags.flatMap(splitHashtags).map(normalizeHashtag)]
        .filter((h): h is string => !!h)
        .filter((h) => (seen.has(h.toLowerCase()) ? false : (seen.add(h.toLowerCase()), true)))
        .slice(0, Math.max(rules.hashtagsMax, fixed.length));
      const captions = p.captions
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((c) => c.slice(0, rules.captionMax));
      return { platform: p.platform, captions, hashtags };
    });
  return {
    internalTitle: raw.internalTitle.trim().slice(0, INTERNAL_TITLE_MAX),
    youtubeTitle: o.platforms.includes('youtube') && raw.youtubeTitle ? raw.youtubeTitle.trim().slice(0, YT_TITLE_MAX) : null,
    byPlatform,
  };
}
