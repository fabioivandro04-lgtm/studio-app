import type { SupabaseClient } from '@supabase/supabase-js';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { listMedia, type MediaItem } from '@/lib/db/repo/media-repo';
import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { utcToLocalParts } from '@/lib/time/zone';

export interface ComposerAccount { id: string; brandId: string; platform: Platform; handle: string; status: string }
export interface ComposerInitial {
  id?: string;
  brandId: string;
  internalTitle: string;
  mediaIds: string[];
  date: string;
  time: string;
  targets: { accountId: string; format: TargetFormat; caption: string; title: string | null }[];
  locked: boolean;
  status?: string;
}
export interface ComposerData {
  brands: { id: string; name: string; color: string; timezone: string }[];
  accounts: ComposerAccount[];
  media: MediaItem[];
  initial: ComposerInitial;
}

function tomorrowAt9(tz: string): { date: string; time: string } {
  const { date } = utcToLocalParts(new Date(Date.now() + 86_400_000), tz);
  return { date, time: '09:00' };
}

export async function loadComposer(
  db: SupabaseClient,
  opts: { postId?: string; brandId?: string | null; date?: string; mediaId?: string },
): Promise<ComposerData | null> {
  const brands = (await listBrands(db)).map(({ id, name, color, timezone }) => ({ id, name, color, timezone }));
  const { data: acc } = await db.from('social_accounts').select('id, brand_id, platform, handle, status').neq('status', 'disabled').order('created_at');
  const accounts = (acc ?? []).map((a) => ({ id: a.id, brandId: a.brand_id, platform: a.platform, handle: a.handle, status: a.status }));
  const media = await listMedia(db, { limit: 300 });

  if (opts.postId) {
    const { data: post } = await db.from('posts').select('*').eq('id', opts.postId).single();
    if (!post) return null;
    const [{ data: pm }, { data: targets }] = await Promise.all([
      db.from('post_media').select('media_id').eq('post_id', post.id).order('position'),
      db.from('post_targets').select('social_account_id, format, caption, title, status').eq('post_id', post.id),
    ]);
    const tz = brands.find((b) => b.id === post.brand_id)?.timezone ?? 'Africa/Maputo';
    const when = post.scheduled_at ? utcToLocalParts(new Date(post.scheduled_at), tz) : tomorrowAt9(tz);
    return {
      brands, accounts, media,
      initial: {
        id: post.id, brandId: post.brand_id, internalTitle: post.internal_title, mediaIds: (pm ?? []).map((m) => m.media_id), ...when,
        targets: (targets ?? []).map((t) => ({ accountId: t.social_account_id, format: t.format, caption: t.caption, title: t.title })),
        locked: !['draft', 'scheduled'].includes(post.status) || (targets ?? []).some((t) => t.status !== 'pending'),
        status: post.status,
      },
    };
  }

  const fromMedia = opts.mediaId ? media.find((m) => m.id === opts.mediaId) : undefined;
  const brandId = fromMedia?.brandId ?? opts.brandId ?? brands[0]?.id ?? '';
  const tz = brands.find((b) => b.id === brandId)?.timezone ?? 'Africa/Maputo';
  const when = tomorrowAt9(tz);
  return {
    brands, accounts, media,
    initial: {
      brandId, internalTitle: '', mediaIds: fromMedia ? [fromMedia.id] : [], targets: [], locked: false,
      date: opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : when.date, time: when.time,
    },
  };
}
