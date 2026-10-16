import { probeBuffer } from '@/lib/media/probe-server';
import type { McpCtx } from './context';
import { ToolError } from './result';

const BUCKET = 'media';
export const UPLOAD_TYPES: Record<string, { ext: string; kind: 'image' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};
const EXT_MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', mp4: 'video/mp4', mov: 'video/quicktime' };
/** Pasta só do Claude: os ficheiros da app (<marca>/<id>.<ext>) nunca são lidos nem apagados pelo MCP. */
export const mcpPath = (brandId: string, file: string) => `${brandId}/mcp/${file}`;
export const ENVIO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|mp4|mov)$/;

/** Tipo aceite pelo MCP: só JPG, MP4 e MOV (o Instagram só aceita JPG; HEIC/PNG convertem-se na app). */
export function acceptType(name: string, mime: string, size: number, maxMb: number): { ext: string; kind: 'image' | 'video'; mime: string } {
  const m = (mime || EXT_MIME[name.split('.').pop()?.toLowerCase() ?? ''] || '').toLowerCase();
  if (size <= 0) throw new ToolError(`"${name}" está vazio.`);
  if (size > maxMb * 1024 * 1024) throw new ToolError(`"${name}" tem ${Math.round(size / 1024 / 1024)} MB; o limite é ${maxMb} MB.`);
  if (m.startsWith('image/') && m !== 'image/jpeg') throw new ToolError('Envie as imagens em JPG (o Instagram só aceita JPG).');
  const t = UPLOAD_TYPES[m];
  if (!t) throw new ToolError(`"${name}": formato não suportado. Use JPG, MP4 ou MOV.`);
  return { ...t, mime: m };
}

const magicOk = (b: Uint8Array, kind: 'image' | 'video') =>
  kind === 'image' ? b[0] === 0xff && b[1] === 0xd8 : b.length > 12 && String.fromCharCode(b[4], b[5], b[6], b[7]) === 'ftyp';

/** Valida o conteúdo já guardado em `path`, lê medidas e cria a linha em media_assets. Conteúdo inválido é apagado. */
export async function registerUpload(ctx: McpCtx, o: { brandId: string; id: string; path: string; bytes: Uint8Array; mime: string; name: string }) {
  if (!o.path.startsWith(`${o.brandId}/mcp/`)) throw new Error('caminho fora da pasta do MCP');
  const t = UPLOAD_TYPES[o.mime];
  const remove = () => ctx.svc().storage.from(BUCKET).remove([o.path]);
  if (!t || !magicOk(o.bytes, t.kind)) {
    await remove();
    throw new ToolError(`"${o.name}" não é um ficheiro JPG/MP4/MOV válido.`);
  }
  if (o.bytes.byteLength > ctx.maxUploadMb * 1024 * 1024) {
    await remove();
    throw new ToolError(`"${o.name}" passa o limite de ${ctx.maxUploadMb} MB.`);
  }
  const probe = probeBuffer(o.bytes, o.mime);
  const { error } = await ctx.db.from('media_assets').insert({
    id: o.id, brand_id: o.brandId, storage_path: o.path, kind: t.kind, mime: o.mime, size_bytes: o.bytes.byteLength,
    width: probe.width, height: probe.height, duration_s: probe.durationS, original_name: o.name.slice(0, 200),
  });
  if (error) {
    // Outra chamada registou o mesmo envio ao mesmo tempo: o ficheiro é dela, não apagar.
    const same = await existingUpload(ctx, o.id);
    if (same) return same;
    await remove();
    throw new Error(`media_assets: ${error.message}`);
  }
  await ctx.db.from('activity_log').insert({ brand_id: o.brandId, level: 'info', source: 'mcp', message: `Claude carregou "${o.name}" para a Biblioteca` });
  return { mediaId: o.id, tipo: t.kind, largura: probe.width, altura: probe.height, duracaoS: probe.durationS };
}

export const storageOf = (ctx: McpCtx, svc = false) => (svc ? ctx.svc() : ctx.db).storage.from(BUCKET);
export { EXT_MIME };

/** Ficheiro já registado com este id (repetição do mesmo envio): devolve-o sem tocar no Storage. */
export async function existingUpload(ctx: McpCtx, id: string) {
  const { data } = await ctx.db.from('media_assets').select('id, kind, width, height, duration_s').eq('id', id).maybeSingle();
  return data ? { mediaId: data.id as string, tipo: data.kind as string, largura: (data.width as number) ?? null, altura: (data.height as number) ?? null, duracaoS: data.duration_s == null ? null : Number(data.duration_s) } : null;
}
