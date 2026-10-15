import { PermanentError } from '../errors';
import type { AccountCtx, AccountMetrics, PostMetrics, RecentPost } from '../types';
import { igApi, type IgConfig } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function igAccountMetrics(cfg: IgConfig, account: AccountCtx, fetchFn: typeof fetch): Promise<AccountMetrics> {
  const me = await igApi(cfg, fetchFn, account.accessToken).get('/me', { fields: 'followers_count,media_count' });
  return { followers: me.followers_count ?? null, views: null, raw: me };
}

const BASE_METRICS = 'reach,views,likes,comments,saved,shares';
const CONTACT_METRICS = 'profile_visits,follows';

export async function igPostMetrics(
  cfg: IgConfig,
  account: AccountCtx,
  ids: string[],
  fetchFn: typeof fetch,
): Promise<Record<string, PostMetrics>> {
  const api = igApi(cfg, fetchFn, account.accessToken);
  const out: Record<string, PostMetrics> = {};
  // Tenta tudo num só pedido; mídia sem métricas de "contactos" (ex.: Reels) recusa-o → repete só com as base.
  const tryGet = async (id: string, metric: string) => {
    try {
      return await api.get(`/${id}/insights`, { metric });
    } catch (e) {
      if (e instanceof PermanentError) return null; // métrica não suportada para este tipo de mídia
      throw e;
    }
  };
  for (const id of ids) {
    const res: any = (await tryGet(id, `${BASE_METRICS},${CONTACT_METRICS}`)) ?? (await tryGet(id, BASE_METRICS));
    if (!res) continue;
    const v = (name: string): number | null => {
      const item = (res.data ?? []).find((d: any) => d.name === name);
      const value = item?.values?.[0]?.value ?? item?.total_value?.value;
      return typeof value === 'number' ? value : null;
    };
    out[id] = {
      views: v('views'), reach: v('reach'), likes: v('likes'), comments: v('comments'), shares: v('shares'),
      saves: v('saved'), watchTimeS: null, isPublic: true, raw: res,
      profileVisits: v('profile_visits'), follows: v('follows'),
    };
  }
  return out;
}

export async function igRecentPosts(cfg: IgConfig, account: AccountCtx, since: Date, fetchFn: typeof fetch): Promise<RecentPost[]> {
  const res = await igApi(cfg, fetchFn, account.accessToken).get(`/${account.externalId}/media`, {
    fields: 'id,permalink,timestamp,caption,thumbnail_url,media_url',
    limit: '25',
  });
  return (res.data ?? [])
    .map((m: any) => ({
      externalId: m.id,
      createdAt: new Date(m.timestamp),
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      title: m.caption ?? null,
    }))
    .filter((p: RecentPost) => p.createdAt >= since);
}
