import { PermanentError } from '../errors';
import type { AccountCtx, AccountMetrics, PostMetrics, RecentPost } from '../types';
import { igApi, type IgConfig } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function igAccountMetrics(cfg: IgConfig, account: AccountCtx, fetchFn: typeof fetch): Promise<AccountMetrics> {
  const me = await igApi(cfg, fetchFn, account.accessToken).get('/me', { fields: 'followers_count,media_count' });
  return { followers: me.followers_count ?? null, views: null, raw: me };
}

export async function igPostMetrics(
  cfg: IgConfig,
  account: AccountCtx,
  ids: string[],
  fetchFn: typeof fetch,
): Promise<Record<string, PostMetrics>> {
  const api = igApi(cfg, fetchFn, account.accessToken);
  const out: Record<string, PostMetrics> = {};
  for (const id of ids) {
    let res: any;
    try {
      res = await api.get(`/${id}/insights`, { metric: 'reach,views,likes,comments,saved,shares' });
    } catch (e) {
      if (e instanceof PermanentError) continue; // ex.: métrica não suportada para este tipo de mídia
      throw e;
    }
    // Métricas de "contactos": nem todos os tipos de mídia as têm, por isso pedem-se à parte e ignora-se qualquer erro.
    let extra: any = null;
    try {
      extra = await api.get(`/${id}/insights`, { metric: 'profile_visits,follows' });
    } catch {
      extra = null;
    }
    const pick = (src: any, name: string): number | null => {
      const item = (src?.data ?? []).find((d: any) => d.name === name);
      const value = item?.values?.[0]?.value ?? item?.total_value?.value;
      return typeof value === 'number' ? value : null;
    };
    const v = (name: string) => pick(res, name);
    out[id] = {
      views: v('views'), reach: v('reach'), likes: v('likes'), comments: v('comments'), shares: v('shares'),
      saves: v('saved'), watchTimeS: null, isPublic: true, raw: extra ? { ...res, extra } : res,
      profileVisits: pick(extra, 'profile_visits'), follows: pick(extra, 'follows'),
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
