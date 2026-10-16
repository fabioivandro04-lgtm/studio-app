import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';
import { acceptType, mcpPath, storageOf } from '../uploads';

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export const pedirEnvio = defineTool({
  name: 'pedir_envio',
  title: 'Pedir envio de ficheiro',
  description: 'Prepara o envio de um ficheiro local (JPG, MP4 ou MOV, até ao limite) para a Biblioteca. Devolve um URL temporário (2 horas) e o comando curl exato. Depois de o curl terminar, chame confirmar_envio com o envioId.',
  input: z.object({ brandId: z.guid('Id de marca inválido.'), nome: z.string().min(1).max(200), mime: z.string().max(100), tamanhoBytes: z.number().int().min(1) }),
  async run({ brandId, nome, mime, tamanhoBytes }, ctx) {
    await loadBrand(ctx.db, BrandId.parse(brandId));
    const t = acceptType(nome, mime, tamanhoBytes, ctx.maxUploadMb);
    const envioId = `${crypto.randomUUID()}.${t.ext}`;
    const { data, error } = await storageOf(ctx).createSignedUploadUrl(mcpPath(brandId, envioId));
    if (error || !data) throw new Error(`signed upload: ${error?.message}`);
    const expiraEm = new Date(ctx.now().getTime() + 2 * 3600_000).toISOString();
    const cmd = `curl -X PUT -H 'Content-Type: ${t.mime}' --data-binary @${q(nome)} ${q(data.signedUrl)}`;
    return ok(`Envie com:\n${cmd}\nDepois chame confirmar_envio com envioId ${envioId}. O link expira em 2 horas.`, { envioId, url: data.signedUrl, mime: t.mime, expiraEm, comando: cmd });
  },
});
