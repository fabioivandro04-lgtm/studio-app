import type { AccountCtx, AccountMetrics, PostMetrics, RecentPost } from '../types';
import { ttApi } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function ttAccountMetrics(account: AccountCtx, fetchFn: typeof fetch): Promise<AccountMetrics> {
  const r = await ttApi(fetchFn, account.accessToken).get('/user/info/', { fields: 'follower_count,likes_count,video_count' });
  const u = r.data?.user ?? {};
  return { followers: u.follower_count ?? null, views: null, raw: u };
}

export async function ttPostMetrics(account: AccountCtx, ids: string[], fetchFn: typeof fetch): Promise<Record<string, PostMetrics>> {
  const api = ttApi(fetchFn, account.accessToken);
  const out: Record<string, PostMetrics> = {};
  for (let i = 0; i < ids.length; i += 20) {
    const r = await api.post(
      '/video/query/',
      { filters: { video_ids: ids.slice(i, i + 20) } },
      { fields: 'id,view_count,like_count,comment_count,share_count' },
    );
    for (const v of r.data?.videos ?? []) {
      out[String(v.id)] = {
        views: v.view_count ?? null, reach: null, likes: v.like_count ?? null, comments: v.comment_count ?? null,
        shares: v.share_count ?? null, saves: null, watchTimeS: null, isPublic: true, raw: v,
      };
    }
  }
  return out;
}

export async function ttRecentPosts(account: AccountCtx, since: Date, fetchFn: typeof fetch): Promise<RecentPost[]> {
  const r = await ttApi(fetchFn, account.accessToken).post(
    '/video/list/',
    { max_count: 20 },
    { fields: 'id,create_time,share_url,cover_image_url,title' },
  );
  return (r.data?.videos ?? [])
    .map((v: any) => ({
      externalId: String(v.id),
      createdAt: new Date(v.create_time * 1000),
      permalink: v.share_url ?? null,
      thumbnailUrl: v.cover_image_url ?? null,
      title: v.title ?? null,
    }))
    .filter((p: RecentPost) => p.createdAt >= since);
}
