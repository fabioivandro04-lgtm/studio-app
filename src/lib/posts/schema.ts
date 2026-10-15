import { z } from 'zod';
import { validateTarget } from '@/lib/platforms/validate';
import { FORMAT_PLATFORM, type MediaInfo, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { localToUtc } from '@/lib/time/zone';

const FORMATS = ['ig_image', 'ig_carousel', 'ig_reel', 'ig_story', 'tiktok_video', 'yt_short'] as const;

export const PostInput = z.object({
  id: z.guid().optional(),
  brandId: z.guid(),
  internalTitle: z.string().max(120, 'O título interno pode ter no máximo 120 caracteres.'),
  mediaIds: z.array(z.guid()).min(1, 'Escolha pelo menos um ficheiro.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Escolha a hora.'),
  targets: z
    .array(z.object({ accountId: z.guid(), format: z.enum(FORMATS), caption: z.string(), title: z.string().nullable() }))
    .min(1, 'Escolha pelo menos uma rede.'),
  intent: z.enum(['draft', 'schedule']),
});
export type PostInputT = z.infer<typeof PostInput>;

export interface PostError {
  targetIndex: number | null;
  field: string;
  message: string;
}

export function checkPost(
  input: PostInputT,
  media: MediaInfo[],
  accounts: { id: string; platform: Platform }[],
  tz: string,
  now: Date,
): { ok: true; scheduledAt: Date } | { ok: false; errors: PostError[] } {
  const parsed = PostInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => ({ targetIndex: null, field: String(i.path[0] ?? ''), message: i.message })) };
  }
  const data = parsed.data;
  const scheduledAt = localToUtc(data.date, data.time, tz);
  if (data.intent === 'draft') return { ok: true, scheduledAt };

  const errors: PostError[] = [];
  if (scheduledAt <= now) errors.push({ targetIndex: null, field: 'date', message: 'A data já passou.' });
  const ordered = data.mediaIds.map((id) => media.find((m) => m.id === id)).filter((m): m is MediaInfo => !!m);
  if (ordered.length !== data.mediaIds.length) errors.push({ targetIndex: null, field: 'mediaIds', message: 'Um dos ficheiros já não existe.' });

  const seen = new Set<string>();
  data.targets.forEach((t, i) => {
    const account = accounts.find((a) => a.id === t.accountId);
    if (!account || FORMAT_PLATFORM[t.format] !== account.platform) {
      errors.push({ targetIndex: i, field: 'format', message: 'Formato incompatível com esta conta.' });
      return;
    }
    if (seen.has(t.accountId)) errors.push({ targetIndex: i, field: 'format', message: 'Esta conta já está escolhida.' });
    seen.add(t.accountId);
    for (const e of validateTarget({ format: t.format, caption: t.caption, title: t.title }, ordered)) {
      errors.push({ targetIndex: i, ...e });
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, scheduledAt };
}

export function defaultFormat(platform: Platform, media: { kind: 'image' | 'video' }[]): TargetFormat {
  if (platform === 'tiktok') return 'tiktok_video';
  if (platform === 'youtube') return 'yt_short';
  if (media.length > 1) return 'ig_carousel';
  return media[0]?.kind === 'video' ? 'ig_reel' : 'ig_image';
}

export const FORMAT_LABEL: Record<TargetFormat, string> = {
  ig_image: 'Imagem', ig_carousel: 'Carrossel', ig_reel: 'Reel', ig_story: 'Story', tiktok_video: 'Vídeo', yt_short: 'Short',
};
