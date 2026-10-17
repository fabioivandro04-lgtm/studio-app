import { z } from 'zod';
import { LinkError } from '@/lib/net/safe-fetch';
import { BrandId, loadBrand } from '../common';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';
import { acceptType, mcpPath, registerUpload, resolveFolder, storageOf } from '../uploads';

export const importarDeLink = defineTool({
  name: 'importar_de_link',
  title: 'Importar de um link',
  description: 'Descarrega um ficheiro de um link público https (JPG, MP4 ou MOV; por exemplo um link de partilha direto) e põe-no na Biblioteca. Devolve o mediaId.',
  input: z.object({ brandId: BrandId, url: z.string().url('Link inválido.').max(2000), pastaId: z.guid('pastaId inválido.').optional() }),
  async run({ brandId, url, pastaId }, ctx) {
    await loadBrand(ctx.db, brandId);
    const folderId = await resolveFolder(ctx, brandId, pastaId);
    let file;
    try {
      file = await ctx.fetchLink(url, ctx.maxUploadMb * 1024 * 1024);
    } catch (e) {
      if (e instanceof LinkError) throw new ToolError(e.message);
      throw new ToolError('Não foi possível descarregar o link.');
    }
    const t = acceptType(file.name, file.mime, file.bytes.byteLength, ctx.maxUploadMb);
    const id = crypto.randomUUID();
    const path = mcpPath(brandId, `${id}.${t.ext}`);
    const { error } = await storageOf(ctx, true).upload(path, file.bytes, { contentType: t.mime, upsert: false });
    if (error) throw new Error(`upload: ${error.message}`);
    const r = await registerUpload(ctx, { brandId, id, path, bytes: file.bytes, mime: t.mime, name: file.name, folderId });
    return ok(`"${file.name}" está na Biblioteca (mediaId ${r.mediaId}).`, r);
  },
});
