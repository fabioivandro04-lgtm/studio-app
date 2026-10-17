import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const pastas = defineTool({
  name: 'pastas',
  title: 'Pastas da Biblioteca',
  description: 'Pastas da marca (id, nome, tema e abordagem, nº de ficheiros) e quantos ficheiros estão sem pasta. Use o id em biblioteca, confirmar_envio e importar_de_link.',
  input: z.object({ brandId: BrandId }),
  readOnly: true,
  async run({ brandId }, ctx) {
    await loadBrand(ctx.db, brandId);
    const [{ data: fs, error: fe }, { data: stats, error: se }, { count: loose }] = await Promise.all([
      ctx.db.from('media_folders').select('id, name, notes').eq('brand_id', brandId).order('name'),
      ctx.db.rpc('media_folder_stats', { p_brand: brandId }),
      ctx.db.from('media_assets').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).is('folder_id', null),
    ]);
    if (fe) throw new Error(`media_folders: ${fe.message}`);
    if (se) throw new Error(`media_folder_stats: ${se.message}`);
    const files = new Map(((stats ?? []) as { folder_id: string; files: number }[]).map((r) => [r.folder_id, r.files]));
    const list = (fs ?? []).map((f) => ({ id: f.id as string, nome: f.name as string, tema: (f.notes as string) ?? '', ficheiros: files.get(f.id as string) ?? 0 }));
    const semPasta = loose ?? 0;
    const text = list.length
      ? `${list.map((f) => `${f.id} · ${f.nome} · ${f.ficheiros} ficheiros`).join('\n')}\nSem pasta: ${semPasta}`
      : `Ainda sem pastas. Sem pasta: ${semPasta}`;
    return ok(text, { pastas: list, semPasta });
  },
});
