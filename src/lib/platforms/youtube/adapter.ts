import { nextMidnightIn } from '@/lib/time/zone';
import { DeferError, PermanentError } from '../errors';
import { requestJson } from '../http';
import type {
  AccountCtx, AccountMetrics, AccountProfile, AdvanceDeps, AdvanceResult, PlatformAdapter, PostMetrics, Progress,
  RecentPost, TargetCtx, TokenSet,
} from '../types';
import { validateYouTube } from './validate';

export interface YtConfig {
  clientId: string;
  clientSecret: string;
  uploadUnits: number;
  dailyUnits: number;
}

const CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KiB
const API = 'https://www.googleapis.com/youtube/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

interface YtProgress extends Progress {
  step?: 'uploading';
  sessionUri?: string;
  offset?: number;
  startedAt?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = async (fetchFn: typeof fetch, url: string, token: string) =>
  (await requestJson(fetchFn, url, { platform: 'youtube', headers: auth(token) })).body;

async function initUpload(cfg: YtConfig, t: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<YtProgress> {
  const now = deps.now();
  if ((await deps.usageToday('yt_units')) + cfg.uploadUnits > cfg.dailyUnits) {
    throw new DeferError(
      'YouTube: quota diária esgotada (contagem local)',
      nextMidnightIn('America/Los_Angeles', now),
      'A quota diária do YouTube acabou. O envio continua depois da meia-noite (hora da Califórnia).',
    );
  }
  const media = t.media[0];
  const res = await requestJson(deps.fetch, `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=${encodeURIComponent('snippet,status')}`, {
    platform: 'youtube',
    method: 'POST',
    headers: {
      ...auth(account.accessToken),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(media.sizeBytes),
      'X-Upload-Content-Type': media.mime,
    },
    body: JSON.stringify({
      snippet: { title: t.title ?? '', description: t.caption, categoryId: '22' },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    }),
    now: deps.now,
  });
  const sessionUri = res.headers.get('location');
  if (!sessionUri) throw new PermanentError('YouTube: sem sessão de upload', 'O YouTube não iniciou o envio.');
  await deps.recordUsage('yt_units', cfg.uploadUnits);
  return { step: 'uploading', sessionUri, offset: 0, startedAt: now.toISOString() };
}

async function advance(cfg: YtConfig, t: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<AdvanceResult> {
  let p = t.progress as YtProgress;
  if (!p.step) p = await initUpload(cfg, t, account, deps);

  const media = t.media[0];
  const size = media.sizeBytes;
  let offset = p.offset ?? 0;
  while (offset < size && deps.now() < deps.deadline) {
    const end = Math.min(offset + CHUNK, size) - 1;
    const bytes = await deps.storage.readRange(media.storagePath, offset, end);
    const res = await requestJson(deps.fetch, p.sessionUri!, {
      platform: 'youtube',
      method: 'PUT',
      headers: { ...auth(account.accessToken), 'Content-Type': media.mime, 'Content-Range': `bytes ${offset}-${end}/${size}` },
      body: bytes as BodyInit,
      now: deps.now,
    });
    if (res.status === 308) {
      const range = res.headers.get('range');
      const m = range?.match(/bytes=0-(\d+)/);
      offset = m ? Number(m[1]) + 1 : 0;
      continue;
    }
    const id = res.body?.id;
    if (!id) throw new PermanentError('YouTube: upload terminou sem id', 'O YouTube terminou o envio mas não devolveu o vídeo.');
    return { kind: 'awaiting_user', progress: { ...p, offset: size }, externalPostId: id, permalink: `https://youtube.com/shorts/${id}` };
  }
  return { kind: 'progress', status: 'uploading', progress: { ...p, offset } };
}

async function tokenRequest(cfg: YtConfig, fetchFn: typeof fetch, params: Record<string, string>) {
  return (
    await requestJson<any>(fetchFn, 'https://oauth2.googleapis.com/token', {
      platform: 'youtube',
      method: 'POST',
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
    })
  ).body;
}

const toTokens = (r: any, now: Date, fallbackRefresh: string | null): TokenSet => ({
  accessToken: r.access_token,
  refreshToken: r.refresh_token ?? fallbackRefresh,
  expiresAt: r.expires_in ? new Date(now.getTime() + r.expires_in * 1000) : null,
  refreshExpiresAt: null,
  scopes: (r.scope ?? '').split(' ').filter(Boolean),
});

async function exchangeCode(cfg: YtConfig, code: string, redirectUri: string, deps: { fetch: typeof fetch; now(): Date }) {
  const r = await tokenRequest(cfg, deps.fetch, { code, grant_type: 'authorization_code', redirect_uri: redirectUri });
  const ch = (await get(deps.fetch, `${API}/channels?part=snippet&mine=true`, r.access_token)).items?.[0];
  if (!ch) throw new PermanentError('YouTube: conta sem canal', 'Esta conta Google não tem um canal do YouTube.');
  const profile: AccountProfile = {
    externalId: ch.id,
    handle: ch.snippet?.customUrl ?? ch.snippet?.title ?? ch.id,
    displayName: ch.snippet?.title ?? ch.id,
    avatarUrl: ch.snippet?.thumbnails?.default?.url ?? null,
  };
  return { tokens: toTokens(r, deps.now(), null), profile };
}

async function accountMetrics(account: AccountCtx, fetchFn: typeof fetch): Promise<AccountMetrics> {
  const ch = (await get(fetchFn, `${API}/channels?part=statistics&mine=true`, account.accessToken)).items?.[0];
  const s = ch?.statistics ?? {};
  return {
    followers: s.subscriberCount != null ? Number(s.subscriberCount) : null,
    views: s.viewCount != null ? Number(s.viewCount) : null,
    raw: s,
  };
}

async function postMetrics(account: AccountCtx, ids: string[], fetchFn: typeof fetch): Promise<Record<string, PostMetrics>> {
  const out: Record<string, PostMetrics> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const videos = await get(fetchFn, `${API}/videos?part=statistics,status&id=${batch.join(',')}`, account.accessToken);
    const watch = new Map<string, number>();
    const qs = new URLSearchParams({
      ids: 'channel==MINE', startDate: '2020-01-01', endDate: today, metrics: 'estimatedMinutesWatched',
      dimensions: 'video', filters: `video==${batch.join(',')}`,
    });
    const report = await get(fetchFn, `https://youtubeanalytics.googleapis.com/v2/reports?${qs}`, account.accessToken);
    for (const [vid, minutes] of report.rows ?? []) watch.set(vid, Number(minutes));
    for (const v of videos.items ?? []) {
      const s = v.statistics ?? {};
      const n = (x: unknown) => (x == null ? null : Number(x));
      out[v.id] = {
        views: n(s.viewCount), reach: null, likes: n(s.likeCount), comments: n(s.commentCount), shares: null, saves: null,
        watchTimeS: watch.has(v.id) ? watch.get(v.id)! * 60 : null,
        isPublic: v.status?.privacyStatus === 'public', raw: v,
      };
    }
  }
  return out;
}

async function recentPosts(account: AccountCtx, since: Date, fetchFn: typeof fetch): Promise<RecentPost[]> {
  const ch = (await get(fetchFn, `${API}/channels?part=contentDetails&mine=true`, account.accessToken)).items?.[0];
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const list = await get(fetchFn, `${API}/playlistItems?part=snippet&maxResults=20&playlistId=${uploads}`, account.accessToken);
  return (list.items ?? [])
    .map((it: any) => ({
      externalId: it.snippet.resourceId.videoId,
      createdAt: new Date(it.snippet.publishedAt),
      permalink: `https://youtube.com/shorts/${it.snippet.resourceId.videoId}`,
      thumbnailUrl: it.snippet.thumbnails?.default?.url ?? null,
      title: it.snippet.title ?? null,
    }))
    .filter((p: RecentPost) => p.createdAt >= since);
}

export function youtubeAdapter(cfg: YtConfig): PlatformAdapter {
  return {
    platform: 'youtube',
    formats: ['yt_short'],
    validate: validateYouTube,
    advance: (t, a, d) => advance(cfg, t, a, d),
    fetchAccountMetrics: (a, d) => accountMetrics(a, d.fetch),
    fetchPostMetrics: (a, ids, d) => postMetrics(a, ids, d.fetch),
    listRecentPosts: (a, since, d) => recentPosts(a, since, d.fetch),
    refreshToken: async (tokens, d) => {
      if (!tokens.refreshToken) throw new PermanentError('YouTube sem refresh token', 'Volte a ligar a conta YouTube.');
      const r = await tokenRequest(cfg, d.fetch, { grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
      return toTokens(r, d.now(), tokens.refreshToken);
    },
    authorizeUrl: (state, redirectUri) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: cfg.clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline',
        prompt: 'consent', state, scope: SCOPES.join(' '),
      })}`,
    exchangeCode: (code, redirectUri, d) => exchangeCode(cfg, code, redirectUri, d),
  };
}
