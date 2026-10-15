import { z } from 'zod';
import { FORMAT_PLATFORM, type Platform, type TargetFormat } from '@/lib/platforms/types';

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const satisfies readonly Platform[];
const FORMATS = Object.keys(FORMAT_PLATFORM) as [TargetFormat, ...TargetFormat[]];
const ACTIONS = ['shorten', 'catchy', 'professional', 'cta', 'english'] as const;

const Platform = z.enum(PLATFORMS, { message: 'Rede desconhecida.' });

/** Entrada de suggestPost (as server actions recebem dados do browser: validar sempre). */
export const SuggestInput = z
  .object({
    brandId: z.guid(),
    prompt: z.string().max(2000),
    mediaId: z.guid().nullable(),
    platforms: z.array(Platform).max(3),
    formats: z.partialRecord(Platform, z.enum(FORMATS, { message: 'Formato desconhecido.' })),
  })
  .refine((v) => Object.entries(v.formats).every(([p, f]) => FORMAT_PLATFORM[f as TargetFormat] === p), {
    message: 'Formato não corresponde à rede.',
  });

export const RefineInput = z.object({
  brandId: z.guid(),
  platform: Platform,
  text: z.string().max(6000),
  action: z.enum(ACTIONS, { message: 'Ação de IA desconhecida.' }),
});
