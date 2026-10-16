import { checkPost, type PostInputT } from '@/lib/posts/schema';
import type { MediaInfo, Platform } from '@/lib/platforms/types';

export type DraftCandidate =
  | { id: string; missing: true }
  | { id: string; missing?: false; status: string; tz: string; input: PostInputT; media: MediaInfo[]; accounts: { id: string; platform: Platform }[] };

/** Decide que rascunhos podem ser agendados agora (mesmas regras do editor) e porque é que os outros não. */
export function planSchedule(cands: DraftCandidate[], now: Date): { ready: { id: string; scheduledAt: Date }[]; skipped: { id: string; reason: string }[] } {
  const ready: { id: string; scheduledAt: Date }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const c of cands) {
    if (c.missing) {
      skipped.push({ id: c.id, reason: 'Post não encontrado.' });
      continue;
    }
    if (c.status !== 'draft') {
      skipped.push({ id: c.id, reason: 'Já não é um rascunho.' });
      continue;
    }
    const r = checkPost({ ...c.input, intent: 'schedule' }, c.media, c.accounts, c.tz, now);
    if (r.ok) ready.push({ id: c.id, scheduledAt: r.scheduledAt });
    else skipped.push({ id: c.id, reason: r.errors[0].message });
  }
  return { ready, skipped };
}
