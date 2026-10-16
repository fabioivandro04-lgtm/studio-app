import { z } from 'zod';
import { instagramRecentPosts } from '@/lib/db/repo/instagram-recent';
import { buildGrid, type PlannedGridPost } from '@/lib/instagram/grid';
import type { PostStatus, RecentPost, TargetFormat } from '@/lib/platforms/types';
import { BrandId, loadBrand } from '../common';
import { describeGrid } from '../insights';
import { ok } from '../result';
import { defineTool } from '../tool';

const FEED: TargetFormat[] = ['ig_image', 'ig_carousel', 'ig_reel'];
const PLANNED: PostStatus[] = ['draft', 'scheduled', 'needs_action', 'publishing'];

export const grelhaInstagram = defineTool({
  name: 'grelha_instagram',
  title: 'Grelha do Instagram',
  description: 'Descreve em texto como fica o perfil do Instagram: primeiro os posts planeados (o mais distante no topo), depois os já publicados. Mostra os 12 primeiros quadrados em linhas de 3.',
  input: z.object({ brandId: BrandId }),
  readOnly: true,
  async run({ brandId }, ctx) {
    const brand = await loadBrand(ctx.db, brandId);
    const { data: ig } = await ctx.db.from('social_accounts').select('id').eq('brand_id', brandId).eq('platform', 'instagram').eq('status', 'active').limit(1).maybeSingle();
    if (!ig) return ok('O Instagram desta marca não está ligado.', { quadrados: [] });

    const { data: posts, error } = await ctx.db.from('posts').select('id, internal_title, scheduled_at, status').eq('brand_id', brandId).in('status', PLANNED).not('scheduled_at', 'is', null);
    if (error) throw new Error(`posts: ${error.message}`);
    const ids = (posts ?? []).map((p) => p.id as string);
    const [{ data: targets }, { data: media }] = ids.length
      ? await Promise.all([
          ctx.db.from('post_targets').select('post_id, format, social_account_id').in('post_id', ids),
          ctx.db.from('post_media').select('post_id').in('post_id', ids),
        ])
      : [{ data: [] }, { data: [] }];
    const planned: PlannedGridPost[] = (posts ?? []).flatMap((p) => {
      const t = (targets ?? []).find((x) => x.post_id === p.id && x.social_account_id === ig.id && FEED.includes(x.format as TargetFormat));
      if (!t) return [];
      const hasMedia = (media ?? []).some((m) => m.post_id === p.id);
      return [{ id: p.id as string, at: new Date(p.scheduled_at as string), status: p.status as PostStatus, thumbUrl: hasMedia ? 'media' : null, title: p.internal_title as string, format: t.format as TargetFormat }];
    });
    let published: RecentPost[] = [];
    let note = '';
    try {
      published = (await instagramRecentPosts(ctx.db, brandId)) ?? [];
    } catch {
      note = '\n(Não foi possível ler as publicações do Instagram agora; só aparecem os planeados.)';
    }
    const items = buildGrid(planned, published);
    return ok(describeGrid(items, brand.timezone) + note, {
      quadrados: items.slice(0, 12).map((it) => (it.kind === 'planned' ? { tipo: 'planeado', postId: it.key.slice(5), estado: it.status, formato: it.format, quando: it.at.toISOString(), titulo: it.title } : { tipo: 'publicado', link: it.href, quando: it.at.toISOString() })),
    });
  },
});
