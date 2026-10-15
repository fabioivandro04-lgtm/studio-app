import type { PostStatus, TargetStatus } from '@/lib/platforms/types';

/** Mesma regra que a função SQL refresh_post_status (supabase/migrations/0003_functions.sql). */
export function derivePostStatus(current: PostStatus, targets: TargetStatus[]): PostStatus {
  if (current === 'draft' || current === 'cancelled' || targets.length === 0) return current;
  const active = targets.filter((t) => t === 'pending' || t === 'uploading' || t === 'processing');
  if (active.length > 0) return targets.every((t) => t === 'pending') ? 'scheduled' : 'publishing';
  if (targets.every((t) => t === 'published')) return 'published';
  if (targets.every((t) => t === 'failed')) return 'failed';
  if (targets.some((t) => t === 'failed')) return 'partial';
  return 'needs_action';
}
