import { z } from 'zod';
import { BrandId, loadBrand } from '../common';
import { ok } from '../result';
import { defineTool } from '../tool';

const VIDEO = new Set(['ig_reel', 'tiktok_video', 'yt_short']);

export const guardarIdeia = defineTool({
  name: 'guardar_ideia',
  title: 'Guardar ideia',
  description: 'Guarda uma ideia nova na secção Ideias do Estúdio (título, gancho, guião, legenda, formato e redes) para usar mais tarde.',
  input: z.object({
    brandId: BrandId,
    titulo: z.string().min(1, 'Dê um título à ideia.').max(120),
    gancho: z.string().max(300).default(''),
    guiao: z.string().max(1500).default(''),
    legenda: z.string().max(2200).default(''),
    formato: z.enum(['ig_image', 'ig_carousel', 'ig_reel', 'ig_story', 'tiktok_video', 'yt_short']).nullable().default(null),
    redes: z.array(z.enum(['instagram', 'tiktok', 'youtube'])).default([]),
  }),
  async run(a, ctx) {
    await loadBrand(ctx.db, a.brandId);
    const { error } = await ctx.db.from('ideas').insert({
      brand_id: a.brandId, kind: a.formato && VIDEO.has(a.formato) ? 'shorts' : 'week', title: a.titulo, hook: a.gancho, outline: a.guiao,
      caption: a.legenda, format: a.formato, platforms: a.redes,
    });
    if (error) throw new Error(`ideas: ${error.message}`);
    await ctx.db.from('activity_log').insert({ brand_id: a.brandId, level: 'info', source: 'mcp', message: `Claude guardou a ideia «${a.titulo}»` });
    return ok(`Ideia «${a.titulo}» guardada em Ideias.`);
  },
});
