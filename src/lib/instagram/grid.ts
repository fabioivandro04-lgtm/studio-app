import type { PostStatus, RecentPost, TargetFormat } from '@/lib/platforms/types';

export interface PlannedGridPost { id: string; at: Date; status: PostStatus; thumbUrl: string | null; title: string; format: TargetFormat }
export type GridItem =
  | { kind: 'planned'; key: string; href: string; thumbUrl: string | null; at: Date; status: PostStatus; title: string; format: TargetFormat }
  | { kind: 'published'; key: string; href: string | null; thumbUrl: string | null; at: Date };

const PUBLISHED_MAX = 24;

/** Como o perfil vai ficar: posts planeados por cima (o mais distante no topo), depois os já publicados. */
export function buildGrid(planned: PlannedGridPost[], published: RecentPost[]): GridItem[] {
  const top: GridItem[] = [...planned]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((p) => ({ kind: 'planned', key: `plan:${p.id}`, href: `/posts/${p.id}`, thumbUrl: p.thumbUrl, at: p.at, status: p.status, title: p.title, format: p.format }));
  const rest: GridItem[] = [...published]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, PUBLISHED_MAX)
    .map((p) => ({ kind: 'published', key: `ig:${p.externalId}`, href: p.permalink, thumbUrl: p.thumbnailUrl, at: p.createdAt }));
  return [...top, ...rest];
}
