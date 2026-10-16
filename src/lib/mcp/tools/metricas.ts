import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { loadMetrics } from '../metrics-data';
import { ok } from '../result';
import { defineTool } from '../tool';

const n = new Intl.NumberFormat('pt-PT');

export const metricas = defineTool({
  name: 'metricas',
  title: 'Métricas',
  description: 'Resultados da marca nos últimos N dias (1 a 90, omissão 30): totais e por rede (visualizações, alcance, gostos, comentários, partilhas, guardados), seguidores ganhos, top 5 posts e melhores horas de publicação.',
  input: z.object({ brandId: BrandId, dias: z.number().int().min(1).max(90, 'No máximo 90 dias.').default(30) }),
  readOnly: true,
  async run({ brandId, dias }, ctx) {
    const brand = await loadBrand(ctx.db, brandId);
    const r = await loadMetrics(ctx.db, brand, dias, ctx.now());
    const text = [
      `Últimos ${dias} dias: ${n.format(r.totais.views)} visualizações, ${n.format(r.totais.likes)} gostos, ${n.format(r.totais.saves)} guardados, ${n.format(r.totais.shares)} partilhas, ${r.seguidoresGanhos >= 0 ? '+' : ''}${n.format(r.seguidoresGanhos)} seguidores.`,
      `Top: ${r.top.map((p) => `${p.titulo} (${p.rede}, ${n.format(p.visualizacoes)})`).join('; ') || 'sem dados'}`,
      `Melhores horas: ${r.melhoresHoras.join(', ') || 'ainda sem histórico suficiente (mínimo 10 posts publicados)'}`,
    ].join('\n');
    return ok(text, { ...r });
  },
});
