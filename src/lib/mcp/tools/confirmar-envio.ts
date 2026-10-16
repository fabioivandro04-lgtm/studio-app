import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { ok, ToolError } from '../result';
import { defineTool } from '../tool';
import { ENVIO_RE, existingUpload, EXT_MIME, mcpPath, registerUpload, storageOf } from '../uploads';

export const confirmarEnvio = defineTool({
  name: 'confirmar_envio',
  title: 'Confirmar envio',
  description: 'Depois do curl de pedir_envio: confirma que o ficheiro chegou, lê medidas e duração e põe-no na Biblioteca. Devolve o mediaId para usar em criar_rascunho.',
  input: z.object({ brandId: BrandId, envioId: z.string().regex(ENVIO_RE, 'envioId inválido.'), nome: z.string().min(1).max(200) }),
  async run({ brandId, envioId, nome }, ctx) {
    await loadBrand(ctx.db, brandId);
    const id = envioId.split('.')[0];
    const already = await existingUpload(ctx, id);
    if (already) return ok(`"${nome}" já está na Biblioteca (mediaId ${already.mediaId}).`, already);
    const path = mcpPath(brandId, envioId);
    const { data, error } = await storageOf(ctx, true).download(path);
    if (error || !data) throw new ToolError('O ficheiro ainda não chegou. Confirme que o envio terminou e tente de novo.');
    const bytes = new Uint8Array(await data.arrayBuffer());
    const mime = EXT_MIME[envioId.split('.').pop()!];
    const r = await registerUpload(ctx, { brandId, id, path, bytes, mime, name: nome });
    return ok(`"${nome}" está na Biblioteca (mediaId ${r.mediaId}${r.largura ? `, ${r.largura}x${r.altura}` : ''}${r.duracaoS ? `, ${r.duracaoS} s` : ''}).`, r);
  },
});
