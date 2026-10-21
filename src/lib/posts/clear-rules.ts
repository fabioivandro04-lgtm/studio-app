import type { PostStatus, TargetStatus } from '@/lib/platforms/types';

const CLEARABLE: PostStatus[] = ['draft', 'scheduled', 'cancelled'];
const TOUCHED: TargetStatus[] = ['uploading', 'processing', 'awaiting_user', 'published'];

export type ClearRow = { id: string; status: PostStatus; targets: TargetStatus[] };

/** Para limpar o calendário: só o que nunca saiu (rascunhos, agendados, cancelados sem nada publicado). Os agendados são cancelados antes. */
export function pickClearable(rows: ClearRow[]): { cancel: string[]; remove: string[] } {
  const ok = rows.filter((r) => CLEARABLE.includes(r.status) && !r.targets.some((t) => TOUCHED.includes(t)));
  return { cancel: ok.filter((r) => r.status === 'scheduled').map((r) => r.id), remove: ok.map((r) => r.id) };
}
