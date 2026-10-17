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

type PostMediaRow = { media_id: string; post_id: string; posts: { internal_title: string; status: PostStatus; scheduled_at: string | null } | null };

/** Linhas de `post_media` com `posts!inner(...)` → UsageRow. */
export const fromPostMediaRows = (rows: PostMediaRow[]): UsageRow[] =>
  rows.flatMap((r) =>
    r.posts ? [{ mediaId: r.media_id, postId: r.post_id, title: r.posts.internal_title, status: r.posts.status, scheduledAt: r.posts.scheduled_at }] : [],
  );
