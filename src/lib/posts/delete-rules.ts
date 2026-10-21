import type { PostStatus, TargetStatus } from '@/lib/platforms/types';

const DELETABLE: PostStatus[] = ['draft', 'published', 'partial', 'failed', 'cancelled'];
const IN_FLIGHT: TargetStatus[] = ['uploading', 'processing', 'awaiting_user'];

/** Pode apagar-se do Estúdio? Nunca um post agendado (cancele primeiro) nem um a meio da publicação. */
export function canDeletePost(status: PostStatus, targetStatuses: TargetStatus[]): boolean {
  return DELETABLE.includes(status) && !targetStatuses.some((t) => IN_FLIGHT.includes(t));
}

/** Pode sair do calendário? Como canDeletePost, mais os agendados que ainda não começaram (são cancelados antes). */
export function canRemoveFromCalendar(status: PostStatus, targetStatuses: TargetStatus[]): boolean {
  if (status === 'scheduled') return targetStatuses.every((t) => t === 'pending');
  return canDeletePost(status, targetStatuses);
}
