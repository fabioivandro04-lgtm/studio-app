import type { PostStatus, TargetStatus } from '@/lib/platforms/types';

const DELETABLE: PostStatus[] = ['draft', 'published', 'partial', 'failed', 'cancelled'];
const IN_FLIGHT: TargetStatus[] = ['uploading', 'processing', 'awaiting_user'];

/** Pode apagar-se do Estúdio? Nunca um post agendado (cancele primeiro) nem um a meio da publicação. */
export function canDeletePost(status: PostStatus, targetStatuses: TargetStatus[]): boolean {
  return DELETABLE.includes(status) && !targetStatuses.some((t) => IN_FLIGHT.includes(t));
}
