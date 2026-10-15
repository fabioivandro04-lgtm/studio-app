import { PROCESSING_TIMEOUT_MIN } from '@/lib/publishing/retry';
import { DeferError, PermanentError } from '../errors';
import type { AccountCtx, AdvanceDeps, AdvanceResult, MediaInfo, PlatformAdapter, Progress, TargetCtx } from '../types';
import { igApi, type IgConfig } from './api';
import { igAccountMetrics, igPostMetrics, igRecentPosts } from './metrics';
import { igAuthorizeUrl, igExchangeCode, igRefreshToken } from './oauth';
import { validateInstagram } from './validate';

const URL_TTL_S = 3600;

interface IgProgress extends Progress {
  step?: 'children' | 'container';
  childIds?: string[];
  containerId?: string;
  startedAt?: string;
}

type Api = ReturnType<typeof igApi>;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function checkPublishingLimit(api: Api, igId: string, now: Date) {
  const res = await api.get(`/${igId}/content_publishing_limit`, { fields: 'quota_usage,config' });
  const row = res.data?.[0];
  const total = row?.config?.quota_total;
  if (typeof total === 'number' && row.quota_usage >= total) {
    throw new DeferError(
      `Instagram: limite de ${total} posts atingido`,
      new Date(now.getTime() + 60 * 60_000),
      `O Instagram só permite ${total} publicações pela API em 24 h. Vamos tentar de novo dentro de 1 hora.`,
    );
  }
}

async function mediaUrlParam(m: MediaInfo, deps: AdvanceDeps) {
  const url = await deps.storage.signedUrl(m.storagePath, URL_TTL_S);
  return m.kind === 'video' ? { video_url: url } : { image_url: url };
}

async function createContainer(api: Api, igId: string, t: TargetCtx, deps: AdvanceDeps): Promise<string> {
  const m = t.media[0];
  const params: Record<string, string | undefined> = { ...(await mediaUrlParam(m, deps)) };
  if (t.format === 'ig_reel') Object.assign(params, { media_type: 'REELS', share_to_feed: 'true', caption: t.caption });
  else if (t.format === 'ig_story') params.media_type = 'STORIES';
  else params.caption = t.caption;
  return (await api.post(`/${igId}/media`, params)).id;
}

async function createChildren(api: Api, igId: string, t: TargetCtx, deps: AdvanceDeps): Promise<string[]> {
  const ids: string[] = [];
  for (const m of t.media) {
    const params: Record<string, string> = { is_carousel_item: 'true', ...(await mediaUrlParam(m, deps)) };
    if (m.kind === 'video') params.media_type = 'VIDEO';
    ids.push((await api.post(`/${igId}/media`, params)).id);
  }
  return ids;
}

async function containerStatus(api: Api, id: string): Promise<string> {
  return (await api.get(`/${id}`, { fields: 'status_code' })).status_code;
}

function failIfBad(status: string) {
  if (status === 'ERROR' || status === 'EXPIRED') {
    throw new PermanentError(
      `Instagram: contentor ${status}`,
      status === 'EXPIRED'
        ? 'O Instagram deixou expirar o envio. Tente de novo.'
        : 'O Instagram não conseguiu processar este ficheiro. Verifique o formato e tente de novo.',
    );
  }
}

function checkTimeout(p: IgProgress, now: Date) {
  if (p.startedAt && now.getTime() - new Date(p.startedAt).getTime() > PROCESSING_TIMEOUT_MIN * 60_000) {
    throw new PermanentError('Instagram: processamento excedeu o tempo', 'Tempo de processamento excedido no Instagram (mais de 30 minutos).');
  }
}

async function recoverPublished(api: Api, igId: string, t: TargetCtx, p: IgProgress): Promise<AdvanceResult> {
  const isStory = t.format === 'ig_story';
  const res = await api.get(`/${igId}/${isStory ? 'stories' : 'media'}`, {
    fields: 'id,permalink,caption,timestamp',
    limit: '10',
  });
  const items: any[] = res.data ?? [];
  const sorted = [...items].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const match = isStory ? sorted[0] : (sorted.find((m) => (m.caption ?? '') === t.caption) ?? sorted[0]);
  if (!match) throw new PermanentError('Instagram: publicado mas não encontrado', 'O post foi publicado mas não foi possível encontrá-lo no Instagram.');
  return { kind: 'published', progress: p, externalPostId: match.id, permalink: match.permalink ?? null };
}

async function advance(cfg: IgConfig, t: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<AdvanceResult> {
  const api = igApi(cfg, deps.fetch, account.accessToken);
  const igId = account.externalId;
  const now = deps.now();
  const p = t.progress as IgProgress;

  if (!p.step) {
    await checkPublishingLimit(api, igId, now);
    const startedAt = now.toISOString();
    if (t.format === 'ig_carousel') {
      const childIds = await createChildren(api, igId, t, deps);
      return { kind: 'progress', status: 'processing', progress: { step: 'children', childIds, startedAt } };
    }
    const containerId = await createContainer(api, igId, t, deps);
    return { kind: 'progress', status: 'processing', progress: { step: 'container', containerId, startedAt } };
  }

  checkTimeout(p, now);

  if (p.step === 'children') {
    const statuses = [];
    for (const id of p.childIds ?? []) statuses.push(await containerStatus(api, id));
    statuses.forEach(failIfBad);
    if (statuses.some((s) => s !== 'FINISHED')) return { kind: 'progress', status: 'processing', progress: p };
    const parent = await api.post(`/${igId}/media`, {
      media_type: 'CAROUSEL',
      children: (p.childIds ?? []).join(','),
      caption: t.caption,
    });
    return { kind: 'progress', status: 'processing', progress: { ...p, step: 'container', containerId: parent.id } };
  }

  const status = await containerStatus(api, p.containerId!);
  failIfBad(status);
  if (status === 'PUBLISHED') return recoverPublished(api, igId, t, p);
  if (status !== 'FINISHED') return { kind: 'progress', status: 'processing', progress: p };

  const published = await api.post(`/${igId}/media_publish`, { creation_id: p.containerId });
  const info = await api.get(`/${published.id}`, { fields: 'permalink' });
  return { kind: 'published', progress: p, externalPostId: published.id, permalink: info.permalink ?? null };
}

export function instagramAdapter(cfg: IgConfig): PlatformAdapter {
  return {
    platform: 'instagram',
    formats: ['ig_image', 'ig_carousel', 'ig_reel', 'ig_story'],
    validate: validateInstagram,
    advance: (t, a, d) => advance(cfg, t, a, d),
    fetchAccountMetrics: (a, d) => igAccountMetrics(cfg, a, d.fetch),
    fetchPostMetrics: (a, ids, d) => igPostMetrics(cfg, a, ids, d.fetch),
    listRecentPosts: (a, since, d) => igRecentPosts(cfg, a, since, d.fetch),
    refreshToken: (tokens, d) => igRefreshToken(tokens.accessToken, d),
    authorizeUrl: (state, redirectUri) => igAuthorizeUrl(cfg, state, redirectUri),
    exchangeCode: (code, redirectUri, d) => igExchangeCode(cfg, code, redirectUri, d),
  };
}
