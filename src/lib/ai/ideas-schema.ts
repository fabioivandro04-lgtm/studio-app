import { z } from 'zod';
import { FORMAT_PLATFORM, type Platform, type TargetFormat } from '@/lib/platforms/types';
import type { JsonSchemaSpec } from './types';

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;
const FORMATS = Object.keys(FORMAT_PLATFORM) as [TargetFormat, ...TargetFormat[]];

export const IDEA_LIMITS = { title: 120, hook: 300, outline: 1500, caption: 2200 } as const;

export interface IdeaDraft {
  title: string;
  hook: string;
  outline: string;
  caption: string;
  format: TargetFormat | null;
  platforms: Platform[];
}

const IdeasZ = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      hook: z.string(),
      outline: z.string(),
      caption: z.string(),
      format: z.enum(FORMATS).nullable(),
      platforms: z.array(z.enum(PLATFORMS)),
    }),
  ),
});

const str = { type: 'string' };
export const IdeasSpec: JsonSchemaSpec<{ ideas: IdeaDraft[] }> = {
  name: 'ideas',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['ideas'],
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'hook', 'outline', 'caption', 'format', 'platforms'],
          properties: {
            title: str,
            hook: str,
            outline: str,
            caption: str,
            format: { anyOf: [{ type: 'string', enum: [...FORMATS] }, { type: 'null' }] },
            platforms: { type: 'array', items: { type: 'string', enum: [...PLATFORMS] } },
          },
        },
      },
    },
  },
  parse: (x) => IdeasZ.parse(x),
};

/** Corta tamanhos, filtra redes/formatos às redes disponíveis da marca e limita à quantidade pedida. */
export function postprocessIdeas(raw: { ideas: IdeaDraft[] }, o: { count: number; platforms: Platform[] }): IdeaDraft[] {
  return raw.ideas
    .map((i) => ({ ...i, title: i.title.trim() }))
    .filter((i) => i.title)
    .slice(0, o.count)
    .map((i) => {
      const inCommon = [...new Set(i.platforms.filter((p) => o.platforms.includes(p)))];
      const platforms = inCommon.length ? inCommon : [...o.platforms];
      const format = i.format && platforms.includes(FORMAT_PLATFORM[i.format]) && inCommon.length ? i.format : null;
      return {
        title: i.title.slice(0, IDEA_LIMITS.title),
        hook: i.hook.trim().slice(0, IDEA_LIMITS.hook),
        outline: i.outline.trim().slice(0, IDEA_LIMITS.outline),
        caption: i.caption.trim().slice(0, IDEA_LIMITS.caption),
        format,
        platforms,
      };
    });
}
