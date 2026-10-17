import { z } from 'zod';
import { ensureFolder } from '@/lib/library/folders';
import { BrandId, loadBrand } from '../common';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';

export const criarPasta = defineTool({
  name: 'criar_pasta',
  title: 'Criar pasta',
  description: 'Cria uma pasta na Biblioteca para juntar os ficheiros de um tema (ex.: as fotos de um carrossel). Se já existir uma com o mesmo nome, devolve essa. Depois use o pastaId em confirmar_envio ou importar_de_link.',
  input: z.object({
    brandId: BrandId,
    nome: z.string().min(1, 'Dê um nome à pasta.').max(80, 'O nome tem até 80 caracteres.'),
    tema: z.string().max(2000).optional(),
  }),
  async run({ brandId, nome, tema }, ctx) {
    await loadBrand(ctx.db, brandId);
    // O agente não pode alterar pastas: o tema vai logo na criação.
    const r = await ensureFolder(ctx.db, { brandId, name: nome, notes: tema });
    if (!r.ok) throw new ToolError(r.error);
    if (r.created) await ctx.db.from('activity_log').insert({ brand_id: brandId, level: 'info', source: 'mcp', message: `Claude criou a pasta «${nome.trim()}» na Biblioteca` });
    return ok(r.created ? `Pasta «${nome.trim()}» criada (pastaId ${r.id}).` : `A pasta «${nome.trim()}» já existia (pastaId ${r.id}).`, { pastaId: r.id, criada: r.created });
  },
});
