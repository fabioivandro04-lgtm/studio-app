import type { PostStatus } from '@/lib/platforms/types';

export type UsageRow = { mediaId: string; postId: string; title: string; status: PostStatus; scheduledAt: string | null };
export type MediaUsage = { count: number; posts: Omit<UsageRow, 'mediaId'>[] };

/** Onde cada ficheiro foi usado: posts não cancelados, um por post, mais recentes primeiro (sem data no fim). */
export function usageOf(rows: UsageRow[]): Map<string, MediaUsage> {
  const out = new Map<string, MediaUsage>();
  for (const { mediaId, ...post } of rows) {
    if (post.status === 'cancelled') continue;
    const u = out.get(mediaId) ?? { count: 0, posts: [] };
    if (u.posts.some((p) => p.postId === post.postId)) continue;
    u.posts.push(post);
    u.count++;
    out.set(mediaId, u);
  }
  for (const u of out.values()) u.posts.sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));
  return out;
}
