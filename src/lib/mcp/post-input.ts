import { z } from 'zod';
import { toMediaInfo } from '@/lib/db/repo/tick-repo';
import { checkPost, defaultFormat, type PostInputT } from '@/lib/posts/schema';
import { FORMAT_PLATFORM, PLATFORM_LABEL, type MediaInfo, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { localToUtc } from '@/lib/time/zone';
import { BrandId, DateStr, loadBrand, TimeStr } from './common';
import type { McpCtx } from './context';
import { ToolError } from './result';

const FORMATS = ['ig_image', 'ig_carousel', 'ig_reel', 'ig_story', 'tiktok_video', 'yt_short'] as const;

export const RascunhoShape = {
  brandId: BrandId,
  titulo: z.string().max(120, 'O título pode ter no máximo 120 caracteres.').default(''),
  mediaIds: z.array(z.guid('Id de ficheiro inválido.')).min(1, 'Escolha pelo menos um ficheiro.').max(10, 'No máximo 10 ficheiros.'),
  data: DateStr,
  hora: TimeStr,
  redes: z
    .array(z.object({
      rede: z.enum(['instagram', 'tiktok', 'youtube']).optional().describe('rede; chega quando a marca só tem uma conta nessa rede'),
      conta: z.string().min(1).optional().describe('id da conta ou @handle (ver "marcas"); use quando houver dúvida'),
      formato: z.enum(FORMATS).optional().describe('omissão: Reel/imagem/carrossel no Instagram conforme os ficheiros, vídeo no TikTok, Short no YouTube'),
      legenda: z.string().max(5000).default(''),
      titulo: z.string().max(100).nullable().optional().describe('título do YouTube Short'),
      capaMs: z.number().int().min(0).max(15 * 60_000).optional().describe('momento do vídeo (ms) para a capa do Reel'),
    }))
    .min(1, 'Escolha pelo menos uma rede.')
    .refine((rs) => rs.every((r) => r.rede || r.conta), 'Indique a rede ou a conta em cada destino.'),
};
export const RascunhoArgs = z.object(RascunhoShape);
export type RascunhoArgsT = z.infer<typeof RascunhoArgs>;

export interface PostContext {
  tz: string;
  accounts: { id: string; platform: Platform; handle: string }[];
  media: MediaInfo[];
}

/** Marca, contas ativas e ficheiros do pedido (todos da marca, senão erro). */
export async function loadPostContext(ctx: McpCtx, a: RascunhoArgsT): Promise<PostContext> {
  const brand = await loadBrand(ctx.db, a.brandId);
  const [{ data: accounts, error }, { data: media, error: e2 }] = await Promise.all([
    ctx.db.from('social_accounts').select('id, platform, handle, brand_id').eq('brand_id', brand.id).neq('status', 'disabled'),
    ctx.db.from('media_assets').select('id, brand_id, kind, mime, size_bytes, width, height, duration_s, storage_path').in('id', a.mediaIds),
  ]);
  if (error || e2) throw new Error(`post ctx: ${(error ?? e2)!.message}`);
  const mine = (media ?? []).filter((m) => m.brand_id === brand.id);
  if (new Set(a.mediaIds).size !== a.mediaIds.length || mine.length !== a.mediaIds.length) throw new ToolError('Um dos ficheiros não existe ou não é desta marca.');
  const byId = new Map(mine.map((m) => [m.id as string, toMediaInfo(m)]));
  return {
    tz: brand.timezone,
    accounts: (accounts ?? []).map((x) => ({ id: x.id as string, platform: x.platform as Platform, handle: String(x.handle ?? '') })),
    media: a.mediaIds.map((id) => byId.get(id)!),
  };
}

const norm = (h: string) => h.trim().replace(/^@/, '').toLowerCase();

/** Converte os argumentos do Claude no PostInput da app (conta por id ou @handle; formato por omissão). */
export function toPostInput(a: RascunhoArgsT, pc: PostContext, intent: 'draft' | 'schedule', id?: string): PostInputT {
  const targets = a.redes.map((r) => {
    const byId = r.conta ? pc.accounts.find((x) => x.id === r.conta) : undefined;
    const list = byId
      ? [byId]
      : pc.accounts.filter((x) => (!r.rede || x.platform === r.rede) && (!r.conta || (r.conta.startsWith('@') && norm(x.handle) === norm(r.conta))));
    const label = [r.rede, r.conta].filter(Boolean).join(' ');
    if (byId && r.rede && byId.platform !== r.rede) throw new ToolError(`A conta ${r.conta} não é de ${PLATFORM_LABEL[r.rede]}.`);
    if (list.length !== 1) {
      if (list.length > 1) throw new ToolError(`Há mais de uma conta "${label}" nesta marca; indique a rede e o id da conta.`);
      throw new ToolError(`A conta ${label} não é desta marca. Use "marcas" para ver as contas.`);
    }
    const account = list[0];
    const format: TargetFormat = r.formato ?? defaultFormat(account.platform, pc.media);
    if (FORMAT_PLATFORM[format] !== account.platform) throw new ToolError(`O formato ${format} não serve para ${PLATFORM_LABEL[account.platform]}.`);
    return { accountId: account.id, format, caption: r.legenda, title: r.titulo ?? null, coverMs: r.capaMs ?? null };
  });
  return { ...(id ? { id } : {}), brandId: a.brandId, internalTitle: a.titulo, mediaIds: a.mediaIds, date: a.data, time: a.hora, targets, intent };
}

/** Avisos que a app daria ao agendar (sem gravar). */
export function scheduleWarnings(a: RascunhoArgsT, pc: PostContext, now: Date): string[] {
  const input = toPostInput(a, pc, 'schedule');
  const r = checkPost(input, pc.media, pc.accounts, pc.tz, now);
  if (r.ok) return [];
  return r.errors.map((e) => {
    if (e.targetIndex == null) return e.message;
    const acc = pc.accounts.find((x) => x.id === input.targets[e.targetIndex!]?.accountId);
    return `${acc ? `${PLATFORM_LABEL[acc.platform]} @${norm(acc.handle)}` : `Rede ${e.targetIndex + 1}`}: ${e.message}`;
  });
}

export const DB_ERRORS: Record<string, string> = {
  post_locked: 'Este post já não é um rascunho editável.',
  media_brand: 'Um dos ficheiros não é desta marca.',
  account_brand: 'Uma das contas não é desta marca.',
  'Só rascunhos': 'O Claude só pode criar rascunhos.',
};

/** Grava com save_post (sempre rascunho, origem "claude"). */
export async function saveDraft(ctx: McpCtx, input: PostInputT, tz: string): Promise<string> {
  const { data, error } = await ctx.db.rpc('save_post', {
    p: { ...input, intent: 'draft', origin: 'claude', scheduledAt: localToUtc(input.date, input.time, tz).toISOString() },
  });
  if (error) {
    const known = Object.keys(DB_ERRORS).find((k) => error.message.includes(k));
    if (known) throw new ToolError(DB_ERRORS[known]);
    throw new Error(`save_post: ${error.message}`);
  }
  return data as string;
}
