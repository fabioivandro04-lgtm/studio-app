import type { GridItem } from '@/lib/instagram/grid';
import type { Bucket } from '@/lib/ai/best-time';
import { summarize, type MetricRow, type Totals } from '@/lib/metrics/summary';
import type { Platform, PostStatus, TargetFormat } from '@/lib/platforms/types';
import { formatInZone } from '@/lib/time/zone';

const STATUS: Record<PostStatus, string> = {
  draft: 'rascunho', scheduled: 'agendado', publishing: 'a publicar', needs_action: 'à espera de ação', published: 'publicado',
  partial: 'parcial', failed: 'falhou', cancelled: 'cancelado',
};
const FORMAT: Partial<Record<TargetFormat, string>> = { ig_image: 'Imagem', ig_carousel: 'Carrossel', ig_reel: 'Reel', ig_story: 'Story' };
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const weekdayName = (d: number) => WEEKDAYS[d] ?? '?';

/** Os 12 primeiros quadrados da grelha do Instagram descritos em texto, 3 por linha. */
export function describeGrid(items: GridItem[], tz: string): string {
  if (!items.length) return 'A grelha está vazia: sem posts planeados nem publicados.';
  const out: string[] = [];
  items.slice(0, 12).forEach((it, i) => {
    if (i % 3 === 0) out.push(`Linha ${i / 3 + 1}:`);
    const when = formatInZone(it.at, tz, it.kind === 'planned' ? 'EEE, d MMM HH:mm' : 'd MMM');
    out.push(
      it.kind === 'planned'
        ? `${i + 1}. [planeado · ${STATUS[it.status]} · ${FORMAT[it.format] ?? it.format} · ${when}] ${it.title || '(sem título)'}${it.thumbUrl ? '' : ' (sem imagem)'}`
        : `${i + 1}. [publicado · ${when}]${it.href ? ` ${it.href}` : ''}`,
    );
  });
  return out.join('\n');
}

export interface MetricsReport {
  totais: Totals;
  porRede: Record<Platform, Totals>;
  top: { titulo: string; rede: Platform; visualizacoes: number; gostos: number; link: string | null }[];
  seguidoresGanhos: number;
  melhoresHoras: string[];
}

export function metricsReport(o: {
  rows: MetricRow[];
  info: Map<string, { title: string; link: string | null }>;
  from: string;
  to: string;
  followersGained: number;
  best: Bucket[];
}): MetricsReport {
  const { totals, byPlatform, latestPerTarget } = summarize(o.rows, o.from, o.to);
  const top = [...latestPerTarget.values()]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map((r) => ({ titulo: o.info.get(r.targetId)?.title || '(sem título)', rede: r.platform, visualizacoes: r.views ?? 0, gostos: r.likes ?? 0, link: o.info.get(r.targetId)?.link ?? null }));
  return {
    totais: totals, porRede: byPlatform, top, seguidoresGanhos: o.followersGained,
    melhoresHoras: o.best.slice(0, 3).map((b) => `${weekdayName(b.weekday)} às ${b.hour}h`),
  };
}
