import { addDays } from 'date-fns';
import { z } from 'zod';
import { upcomingDeadlines } from '@/lib/db/repo/ideas-repo';
import { utcToLocalParts } from '@/lib/time/zone';
import { BrandId, loadBrand } from '../common';
import { loadMetrics } from '../metrics-data';
import { ok } from '../result';
import { defineTool } from '../tool';

const n = new Intl.NumberFormat('pt-PT');

export const resumoSemana = defineTool({
  name: 'resumo_semana',
  title: 'Resumo da semana',
  description: 'Resumo dos últimos 7 dias da marca: o que saiu, números principais, rascunhos ainda por agendar e prazos dos próximos 14 dias. Útil para sugerir o que fazer a seguir.',
  input: z.object({ brandId: BrandId }),
  readOnly: true,
  async run({ brandId }, ctx) {
    const brand = await loadBrand(ctx.db, brandId);
    const now = ctx.now();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const today = utcToLocalParts(now, brand.timezone).date;
    const in14 = addDays(new Date(`${today}T12:00:00Z`), 14).toISOString().slice(0, 10);
    const [{ data: published }, { data: drafts }, deadlines, metrics] = await Promise.all([
      ctx.db.from('posts').select('id, internal_title, scheduled_at').eq('brand_id', brandId).in('status', ['published', 'partial']).gte('scheduled_at', weekAgo.toISOString()).lte('scheduled_at', now.toISOString()).order('scheduled_at'),
      ctx.db.from('posts').select('id, internal_title, scheduled_at').eq('brand_id', brandId).eq('status', 'draft').order('scheduled_at'),
      upcomingDeadlines(ctx.db, brandId, today, in14),
      loadMetrics(ctx.db, brand, 7, now),
    ]);
    const local = (iso: string | null) => (iso ? utcToLocalParts(new Date(iso), brand.timezone) : { date: null, time: null });
    const data = {
      publicados: (published ?? []).map((p) => ({ id: p.id as string, titulo: (p.internal_title as string) || '(sem título)', data: local(p.scheduled_at as string).date })),
      numeros: { visualizacoes: metrics.totais.views, gostos: metrics.totais.likes, guardados: metrics.totais.saves, partilhas: metrics.totais.shares, seguidoresGanhos: metrics.seguidoresGanhos },
      rascunhosPorAgendar: (drafts ?? []).map((p) => ({ id: p.id as string, titulo: (p.internal_title as string) || '(sem título)', data: local(p.scheduled_at as string | null).date, link: `${ctx.appUrl}/posts/${p.id}` })),
      proximosPrazos: deadlines.map((d) => ({ titulo: d.title, data: d.dueDate })),
    };
    const text = [
      `Esta semana saíram ${data.publicados.length} posts: ${data.publicados.map((p) => p.titulo).join(', ') || 'nenhum'}.`,
      `Números (7 dias): ${n.format(data.numeros.visualizacoes)} visualizações, ${n.format(data.numeros.gostos)} gostos, ${data.numeros.seguidoresGanhos >= 0 ? '+' : ''}${n.format(data.numeros.seguidoresGanhos)} seguidores.`,
      `Rascunhos por agendar: ${data.rascunhosPorAgendar.length}${data.rascunhosPorAgendar.map((p) => `\n- ${p.data ?? 'sem data'} ${p.titulo}`).join('')}`,
      `Prazos nos próximos 14 dias: ${data.proximosPrazos.map((d) => `${d.data} ${d.titulo}`).join('; ') || 'nenhum'}`,
    ].join('\n');
    return ok(text, data);
  },
});
