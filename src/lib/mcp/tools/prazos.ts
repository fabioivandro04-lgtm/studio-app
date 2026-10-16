import { z } from 'zod';
import { upcomingDeadlines } from '@/lib/db/repo/ideas-repo';
import { BrandId, checkRange, DateStr, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const prazos = defineTool({
  name: 'prazos',
  title: 'Prazos',
  description: 'Datas importantes da marca (candidaturas, campanhas, eventos) entre duas datas (no máximo 366 dias).',
  input: z.object({ brandId: BrandId, de: DateStr, ate: DateStr }),
  readOnly: true,
  async run({ brandId, de, ate }, ctx) {
    checkRange(de, ate, 366);
    await loadBrand(ctx.db, brandId);
    const list = (await upcomingDeadlines(ctx.db, brandId, de, ate)).map((d) => ({ id: d.id, titulo: d.title, data: d.dueDate, instituicao: d.institution ?? null, pais: d.country ?? null }));
    return ok(list.length ? list.map((d) => `${d.data} · ${d.titulo}`).join('\n') : 'Sem prazos nesse intervalo.', { prazos: list });
  },
});
