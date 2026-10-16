import { z } from 'zod';
import { utcToLocalParts } from '@/lib/time/zone';
import type { Brand } from '@/lib/db/types';
import { accountsById, BrandId, loadBrand, loadBrands } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const estadoPublicacoes = defineTool({
  name: 'estado_publicacoes',
  title: 'Estado das publicações',
  description: 'Últimos 14 dias: o que foi publicado (com link), o que falhou (com motivo) e o que está à espera de um toque do dono na app do TikTok/YouTube.',
  input: z.object({ brandId: BrandId.optional() }),
  readOnly: true,
  async run({ brandId }, ctx) {
    const brands: Brand[] = brandId ? [await loadBrand(ctx.db, brandId)] : await loadBrands(ctx.db);
    const tz = new Map(brands.map((b) => [b.id, b.timezone]));
    const since = new Date(ctx.now().getTime() - 14 * 86400_000);
    const { data: posts, error } = await ctx.db
      .from('posts').select('id, brand_id, internal_title, scheduled_at, status')
      .in('brand_id', brands.map((b) => b.id)).gte('scheduled_at', since.toISOString()).lte('scheduled_at', ctx.now().toISOString()).order('scheduled_at', { ascending: false });
    if (error) throw new Error(`posts: ${error.message}`);
    const ids = (posts ?? []).map((p) => p.id as string);
    const { data: targets, error: e2 } = ids.length
      ? await ctx.db.from('post_targets').select('post_id, social_account_id, status, permalink, last_error').in('post_id', ids)
      : { data: [], error: null };
    if (e2) throw new Error(`targets: ${e2.message}`);
    const accounts = await accountsById(ctx.db, (targets ?? []).map((t) => t.social_account_id as string));
    const byId = new Map((posts ?? []).map((p) => [p.id as string, p]));
    const row = (t: Record<string, unknown>) => {
      const p = byId.get(t.post_id as string)!;
      const { date, time } = utcToLocalParts(new Date(p.scheduled_at as string), tz.get(p.brand_id as string) ?? 'UTC');
      return { postId: p.id as string, titulo: (p.internal_title as string) || '(sem título)', rede: accounts.get(t.social_account_id as string)?.platform ?? '?', quando: `${date} ${time}` };
    };
    const ts = targets ?? [];
    const publicados = ts.filter((t) => t.status === 'published').map((t) => ({ ...row(t), link: (t.permalink as string) ?? null }));
    const falhados = ts.filter((t) => t.status === 'failed').map((t) => ({ ...row(t), motivo: (t.last_error as string) ?? 'sem detalhe' }));
    const aEsperaDeToque = ts.filter((t) => t.status === 'awaiting_user').map(row);
    const text = [
      `Publicados: ${publicados.length}${publicados.map((p) => `\n- ${p.quando} ${p.titulo} (${p.rede})`).join('')}`,
      `Falhados: ${falhados.length}${falhados.map((p) => `\n- ${p.quando} ${p.titulo} (${p.rede}): ${p.motivo}`).join('')}`,
      `À espera de um toque na app: ${aEsperaDeToque.length}${aEsperaDeToque.map((p) => `\n- ${p.quando} ${p.titulo} (${p.rede})`).join('')}`,
    ].join('\n');
    return ok(text, { publicados, falhados, aEsperaDeToque });
  },
});
