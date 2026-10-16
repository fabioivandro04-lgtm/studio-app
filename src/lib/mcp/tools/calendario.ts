import { z } from 'zod';
import { utcToLocalParts } from '@/lib/time/zone';
import type { Brand } from '@/lib/db/types';
import { accountsById, BrandId, checkRange, DateStr, loadBrand, loadBrands, localDayRange } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

export const calendario = defineTool({
  name: 'calendario',
  title: 'Calendário',
  description: 'Posts entre duas datas (no máximo 62 dias): data e hora locais da marca, estado (draft, scheduled, published…), origem (app ou claude), redes e link. Sem brandId devolve todas as marcas.',
  input: z.object({ brandId: BrandId.optional(), de: DateStr, ate: DateStr }),
  readOnly: true,
  async run({ brandId, de, ate }, ctx) {
    checkRange(de, ate, 62);
    const brands: Brand[] = brandId ? [await loadBrand(ctx.db, brandId)] : await loadBrands(ctx.db);
    const posts = [];
    for (const b of brands) {
      const { from, to } = localDayRange(de, ate, b.timezone);
      const { data, error } = await ctx.db
        .from('posts').select('id, brand_id, internal_title, scheduled_at, status, origin')
        .eq('brand_id', b.id).gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()).order('scheduled_at');
      if (error) throw new Error(`posts: ${error.message}`);
      posts.push(...(data ?? []).map((p) => ({ ...p, tz: b.timezone })));
    }
    const ids = posts.map((p) => p.id as string);
    const { data: targets, error } = ids.length
      ? await ctx.db.from('post_targets').select('post_id, social_account_id, format, status').in('post_id', ids)
      : { data: [], error: null };
    if (error) throw new Error(`targets: ${error.message}`);
    const accounts = await accountsById(ctx.db, (targets ?? []).map((t) => t.social_account_id as string));
    const out = posts.map((p) => {
      const { date, time } = utcToLocalParts(new Date(p.scheduled_at as string), p.tz);
      return {
        id: p.id as string, marcaId: p.brand_id as string, titulo: (p.internal_title as string) || '(sem título)', data: date, hora: time,
        estado: p.status as string, origem: (p.origin as string) ?? 'app',
        redes: (targets ?? []).filter((t) => t.post_id === p.id).map((t) => ({ rede: accounts.get(t.social_account_id as string)?.platform ?? '?', formato: t.format as string, estado: t.status as string })),
        link: `${ctx.appUrl}/posts/${p.id}`,
      };
    });
    const text = out.length
      ? out.map((p) => `${p.data} ${p.hora} · ${p.titulo} · ${p.estado}${p.origem === 'claude' ? ' · criado pelo Claude' : ''} · ${p.redes.map((r) => r.rede).join(', ') || 'sem redes'}`).join('\n')
      : `Sem posts entre ${de} e ${ate}.`;
    return ok(text, { posts: out });
  },
});
