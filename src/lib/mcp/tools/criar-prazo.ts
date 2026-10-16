import { z } from 'zod';
import { BrandId, DateStr, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const criarPrazo = defineTool({
  name: 'criar_prazo',
  title: 'Criar prazo',
  description: 'Cria uma data importante (candidatura, campanha, evento) que aparece no calendário do Estúdio.',
  input: z.object({
    brandId: BrandId,
    titulo: z.string().min(1, 'Dê um título ao prazo.').max(200),
    data: DateStr,
    instituicao: z.string().max(200).optional(),
    pais: z.string().max(100).optional(),
    url: z.string().url('Link inválido.').max(1000).optional(),
  }),
  async run(a, ctx) {
    await loadBrand(ctx.db, a.brandId);
    const { error } = await ctx.db.from('deadlines').insert({
      brand_id: a.brandId, title: a.titulo, due_date: a.data, institution: a.instituicao ?? null, country: a.pais ?? null, url: a.url ?? null,
    });
    if (error) throw new Error(`deadlines: ${error.message}`);
    await ctx.db.from('activity_log').insert({ brand_id: a.brandId, level: 'info', source: 'mcp', message: `Claude criou o prazo «${a.titulo}» (${a.data})` });
    return ok(`Prazo «${a.titulo}» criado para ${a.data}.`);
  },
});
