import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const biblioteca = defineTool({
  name: 'biblioteca',
  title: 'Biblioteca',
  description: 'Ficheiros da marca já carregados (id, nome, tipo, medidas, duração, pasta), mais recentes primeiro. Filtre por texto no nome/etiquetas, por tipo e por pasta (pastaId, de pastas). Use os ids em criar_rascunho.',
  input: z.object({
    brandId: BrandId,
    texto: z.string().max(100).optional(),
    tipo: z.enum(['image', 'video']).optional(),
    pastaId: z.guid('pastaId inválido.').optional(),
    limite: z.number().int().min(1).max(50, 'No máximo 50 ficheiros.').default(20),
  }),
  readOnly: true,
  async run({ brandId, texto, tipo, pastaId, limite }, ctx) {
    await loadBrand(ctx.db, brandId);
    let q = ctx.db.from('media_assets').select('id, original_name, kind, mime, width, height, duration_s, tags, folder_id, created_at').eq('brand_id', brandId);
    if (tipo) q = q.eq('kind', tipo);
    if (pastaId) q = q.eq('folder_id', pastaId);
    const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(`media: ${error.message}`);
    const { data: fs } = await ctx.db.from('media_folders').select('id, name').eq('brand_id', brandId);
    const folderName = new Map((fs ?? []).map((f) => [f.id as string, f.name as string]));
    const needle = texto?.trim().toLowerCase();
    const rows = (data ?? []).filter((m) => !needle || String(m.original_name ?? '').toLowerCase().includes(needle) || ((m.tags as string[]) ?? []).some((t) => t.toLowerCase().includes(needle)));
    const ficheiros = rows.slice(0, limite).map((m) => ({
      id: m.id as string, nome: (m.original_name as string) ?? '', tipo: m.kind as string, mime: m.mime as string,
      largura: (m.width as number) ?? null, altura: (m.height as number) ?? null, duracaoS: m.duration_s == null ? null : Number(m.duration_s),
      etiquetas: (m.tags as string[]) ?? [], criadoEm: String(m.created_at).slice(0, 10),
      pasta: m.folder_id && folderName.has(m.folder_id as string) ? { id: m.folder_id as string, nome: folderName.get(m.folder_id as string)! } : null,
    }));
    const text = ficheiros.length
      ? ficheiros.map((f) => `${f.id} · ${f.nome} · ${f.tipo}${f.largura ? ` ${f.largura}x${f.altura}` : ''}${f.duracaoS ? ` ${f.duracaoS}s` : ''}`).join('\n')
      : 'Nenhum ficheiro encontrado.';
    return ok(text, { ficheiros });
  },
});
