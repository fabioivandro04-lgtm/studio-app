import type { RecentPost } from '@/lib/platforms/types';

/**
 * Associa envios para a caixa de entrada do TikTok aos vídeos publicados: por ordem de envio, cada destino
 * fica com o primeiro vídeo criado depois do envio que ainda não esteja associado.
 */
export function matchTikTokUploads(
  pending: Array<{ targetId: string; uploadedAt: Date }>,
  recent: RecentPost[],
  alreadyLinked: Set<string>,
): Array<{ targetId: string; post: RecentPost }> {
  const used = new Set(alreadyLinked);
  const videos = [...recent].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const out: Array<{ targetId: string; post: RecentPost }> = [];
  for (const p of [...pending].sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())) {
    const v = videos.find((x) => !used.has(x.externalId) && x.createdAt >= p.uploadedAt);
    if (!v) continue;
    used.add(v.externalId);
    out.push({ targetId: p.targetId, post: v });
  }
  return out;
}
