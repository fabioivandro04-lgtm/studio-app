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
    const [{ data: fs, error: fe }, { data: ms, error: me }] = await Promise.all([
      ctx.db.from('media_folders').select('id, name, notes').eq('brand_id', brandId).order('name'),
      ctx.db.from('media_assets').select('folder_id').eq('brand_id', brandId).limit(5000),
    ]);
    if (fe) throw new Error(`media_folders: ${fe.message}`);
    if (me) throw new Error(`media_assets: ${me.message}`);
    const count = new Map<string | null, number>();
    for (const m of ms ?? []) count.set((m.folder_id as string) ?? null, (count.get((m.folder_id as string) ?? null) ?? 0) + 1);
    const list = (fs ?? []).map((f) => ({ id: f.id as string, nome: f.name as string, tema: (f.notes as string) ?? '', ficheiros: count.get(f.id as string) ?? 0 }));
    const semPasta = count.get(null) ?? 0;
    const text = list.length
      ? `${list.map((f) => `${f.id} · ${f.nome} · ${f.ficheiros} ficheiros`).join('\n')}\nSem pasta: ${semPasta}`
      : `Ainda sem pastas. Sem pasta: ${semPasta}`;
    return ok(text, { pastas: list, semPasta });
  },
});
