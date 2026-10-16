/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromBrandRow, type Brand } from '@/lib/db/types';
import { toMediaInfo } from '@/lib/db/repo/tick-repo';
import { checkPost, type PostInputT } from '@/lib/posts/schema';
import { PLATFORM_LABEL, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { utcToLocalParts } from '@/lib/time/zone';
import type { DraftCandidate } from './schedule';

export interface ClaudeDraft {
  id: string;
  title: string;
  brandName: string;
  brandColor: string;
  date: string;
  time: string;
  platforms: Platform[];
  caption: string;
  thumbPath: string | null;
  warnings: string[];
}

/** Rascunhos (por ids, ou todos os do Claude) com tudo o que é preciso para os validar e mostrar. */
export async function loadDrafts(db: SupabaseClient, o: { ids?: string[]; brandId?: string | null; claudeOnly?: boolean }): Promise<{ candidates: DraftCandidate[]; brands: Brand[]; posts: any[] }> {
  let q = db.from('posts').select('id, brand_id, internal_title, scheduled_at, status, origin, created_at');
  if (o.ids) q = q.in('id', o.ids);
  if (o.claudeOnly) q = q.eq('origin', 'claude').eq('status', 'draft');
  if (o.brandId) q = q.eq('brand_id', o.brandId);
  const { data: posts, error } = await q.order('scheduled_at', { ascending: true }).limit(200);
  if (error) throw new Error(`posts: ${error.message}`);
  const ids = (posts ?? []).map((p) => p.id as string);
  const brandIds = [...new Set((posts ?? []).map((p) => p.brand_id as string))];
  const [{ data: pm }, { data: targets }, { data: brands }, { data: accounts }] = ids.length
    ? await Promise.all([
        db.from('post_media').select('post_id, position, media_assets(id, kind, mime, size_bytes, width, height, duration_s, storage_path, thumbnail_path)').in('post_id', ids),
        db.from('post_targets').select('post_id, social_account_id, format, caption, title, options').in('post_id', ids),
        db.from('brands').select('*').in('id', brandIds),
        db.from('social_accounts').select('id, brand_id, platform').in('brand_id', brandIds).neq('status', 'disabled'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const brandList = (brands ?? []).map(fromBrandRow);
  const found = new Map((posts ?? []).map((p) => [p.id as string, p]));
  const wanted = o.ids ?? ids;
  const candidates: DraftCandidate[] = wanted.map((id) => {
    const p = found.get(id);
    if (!p) return { id, missing: true };
    const tz = brandList.find((b) => b.id === p.brand_id)?.timezone ?? 'UTC';
    const media = ((pm ?? []) as any[]).filter((m) => m.post_id === id).sort((a, b) => a.position - b.position).map((m) => toMediaInfo(m.media_assets));
    const when = p.scheduled_at ? utcToLocalParts(new Date(p.scheduled_at), tz) : { date: '', time: '' };
    const input: PostInputT = {
      id, brandId: p.brand_id, internalTitle: p.internal_title ?? '', mediaIds: media.map((m) => m.id), date: when.date, time: when.time, intent: 'schedule',
      targets: ((targets ?? []) as any[]).filter((t) => t.post_id === id).map((t) => ({
        accountId: t.social_account_id, format: t.format as TargetFormat, caption: t.caption ?? '', title: t.title ?? null,
        coverMs: typeof t.options?.thumbOffsetMs === 'number' ? t.options.thumbOffsetMs : null,
      })),
    };
    return { id, status: p.status, tz, input, media, accounts: ((accounts ?? []) as any[]).filter((a) => a.brand_id === p.brand_id).map((a) => ({ id: a.id, platform: a.platform as Platform })) };
  });
  return { candidates, brands: brandList, posts: [...(posts ?? []).map((p) => ({ ...p, _media: ((pm ?? []) as any[]).filter((m) => m.post_id === p.id).sort((a, b) => a.position - b.position) }))] };
}

/** Avisos legíveis que o editor daria ao agendar ("Instagram: O Reel tem de ter pelo menos 3 s."). */
export function draftWarnings(c: Extract<DraftCandidate, { status: string }>, now: Date): string[] {
  if (!c.input.date) return ['Falta escolher o dia e a hora.'];
  const r = checkPost(c.input, c.media, c.accounts, c.tz, now);
  if (r.ok) return [];
  return r.errors.map((e) => {
    const acc = e.targetIndex == null ? null : c.accounts.find((a) => a.id === c.input.targets[e.targetIndex!]?.accountId);
    return acc ? `${PLATFORM_LABEL[acc.platform]}: ${e.message}` : e.message;
  });
}

export function toClaudeDraft(c: Extract<DraftCandidate, { status: string }>, post: any, brands: Brand[], now: Date): ClaudeDraft {
  const b = brands.find((x) => x.id === post.brand_id);
  const first = post._media?.[0]?.media_assets;
  return {
    id: c.id, title: post.internal_title || 'Sem título', brandName: b?.name ?? '', brandColor: b?.color ?? '#999999',
    date: c.input.date, time: c.input.time,
    platforms: [...new Set(c.input.targets.map((t) => c.accounts.find((a) => a.id === t.accountId)?.platform).filter(Boolean))] as Platform[],
    caption: c.input.targets[0]?.caption ?? '', thumbPath: first ? (first.thumbnail_path ?? (first.kind === 'image' ? first.storage_path : null)) : null,
    warnings: draftWarnings(c, now),
  };
}
