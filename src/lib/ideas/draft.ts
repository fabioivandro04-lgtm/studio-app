import { z } from 'zod';
import { FORMAT_PLATFORM, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { defaultFormat } from '@/lib/posts/schema';

export const GenerateInput = z.object({ brandId: z.guid({ message: 'Escolha uma marca primeiro.' }) });
export const DeadlineInput = GenerateInput.extend({ deadlineId: z.guid({ message: 'Escolha um prazo.' }) });
export const IdeaIdInput = z.object({ ideaId: z.guid({ message: 'Ideia não encontrada.' }) });
export const IdeaStatusInput = IdeaIdInput.extend({ status: z.enum(['new', 'discarded']) });

export interface DraftPayload {
  brandId: string;
  internalTitle: string;
  scheduledAt: string;
  intent: 'draft';
  mediaIds: string[];
  targets: { accountId: string; format: TargetFormat; caption: string; title: string }[];
}

/** Rascunho (sem mídia) para save_post: uma conta ativa por rede da ideia. */
export function draftPayload(o: {
  brandId: string;
  idea: { title: string; caption: string; format: TargetFormat | null; platforms: Platform[] };
  scheduledAt: Date;
  accounts: { id: string; platform: Platform; status: string }[];
}): DraftPayload {
  const targets = o.idea.platforms.flatMap((platform) => {
    const acc = o.accounts.find((a) => a.platform === platform && a.status === 'active');
    if (!acc) return [];
    const format = o.idea.format && FORMAT_PLATFORM[o.idea.format] === platform ? o.idea.format : defaultFormat(platform, []);
    return [{ accountId: acc.id, format, caption: o.idea.caption, title: platform === 'youtube' ? o.idea.title : '' }];
  });
  return {
    brandId: o.brandId,
    internalTitle: o.idea.title,
    scheduledAt: o.scheduledAt.toISOString(),
    intent: 'draft',
    mediaIds: [],
    targets,
  };
}
