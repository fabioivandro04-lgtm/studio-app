import { PROCESSING_TIMEOUT_MIN } from '@/lib/publishing/retry';
import { PermanentError, TransientError } from '../errors';
import { requestJson } from '../http';
import type { AccountCtx, AdvanceDeps, AdvanceResult, PlatformAdapter, Progress, TargetCtx } from '../types';
import { ttApi, type TtConfig } from './api';
import { ttAccountMetrics, ttPostMetrics, ttRecentPosts } from './metrics';
import { ttAuthorizeUrl, ttExchangeCode, ttRefreshToken } from './oauth';
import { validateTikTok } from './validate';

const MiB = 1024 * 1024;
const CHUNK = 10 * MiB;
const MIN_CHUNK = 5 * MiB;
const UPLOAD_URL_TTL_MIN = 55;

export function planChunks(size: number): { chunkSize: number; totalChunks: number } {
  if (size < MIN_CHUNK) return { chunkSize: size, totalChunks: 1 };
  return { chunkSize: CHUNK, totalChunks: Math.max(1, Math.floor(size / CHUNK)) };
}

interface TtProgress extends Progress {
  step?: 'uploading' | 'processing';
  publishId?: string;
  uploadUrl?: string;
  chunkSize?: number;
  totalChunks?: number;
  nextChunk?: number;
  startedAt?: string;
  uploadedAt?: string;
}

const FAIL_REASONS: Record<string, string> = {
  file_format_check_failed: 'O TikTok recusou o formato do vídeo.',
  duration_check_failed: 'O TikTok recusou a duração do vídeo.',
  frame_rate_check_failed: 'O TikTok recusou a taxa de fotogramas do vídeo.',
  picture_size_check_failed: 'O TikTok recusou a resolução do vídeo.',
  video_pull_failed: 'O TikTok não conseguiu obter o vídeo.',
  spam_risk_too_many_posts: 'O TikTok limitou as publicações desta conta por hoje.',
  spam_risk_user_banned_from_posting: 'Esta conta está impedida de publicar no TikTok.',
};

async function init(t: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<TtProgress> {
  const size = t.media[0].sizeBytes;
  const { chunkSize, totalChunks } = planChunks(size);
  const r = await ttApi(deps.fetch, account.accessToken).post('/post/publish/inbox/video/init/', {
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunks },
  });
  return {
    step: 'uploading',
    publishId: r.data.publish_id,
    uploadUrl: r.data.upload_url,
    chunkSize,
    totalChunks,
    nextChunk: 0,
    startedAt: deps.now().toISOString(),
  };
}

async function uploadChunks(t: TargetCtx, p: TtProgress, deps: AdvanceDeps): Promise<TtProgress> {
  const media = t.media[0];
  const size = media.sizeBytes;
  let next = p.nextChunk ?? 0;
  const total = p.totalChunks!;
  while (next < total && deps.now() < deps.deadline) {
    const start = next * p.chunkSize!;
    const end = next === total - 1 ? size - 1 : start + p.chunkSize! - 1;
    const bytes = await deps.storage.readRange(media.storagePath, start, end);
    await requestJson(deps.fetch, p.uploadUrl!, {
      platform: 'tiktok',
      method: 'PUT',
      headers: {
        'Content-Type': media.mime,
        'Content-Range': `bytes ${start}-${end}/${size}`,
      },
      body: bytes as BodyInit,
    });
    next++;
  }
  return { ...p, nextChunk: next, step: next >= total ? 'processing' : 'uploading' };
}

async function advance(t: TargetCtx, account: AccountCtx, deps: AdvanceDeps): Promise<AdvanceResult> {
  const now = deps.now();
  let p = t.progress as TtProgress;
  const age = p.startedAt ? now.getTime() - new Date(p.startedAt).getTime() : 0;

  if (!p.step || (p.step === 'uploading' && age > UPLOAD_URL_TTL_MIN * 60_000)) {
    p = await init(t, account, deps);
  }

  if (p.step === 'uploading') {
    p = await uploadChunks(t, p, deps);
    return { kind: 'progress', status: p.step === 'processing' ? 'processing' : 'uploading', progress: p };
  }

  if (age > PROCESSING_TIMEOUT_MIN * 60_000) {
    throw new PermanentError('TikTok: processamento excedeu o tempo', 'Tempo de processamento excedido no TikTok (mais de 30 minutos).');
  }

  const r = await ttApi(deps.fetch, account.accessToken).post('/post/publish/status/fetch/', { publish_id: p.publishId });
  const status: string = r.data?.status;
  switch (status) {
    case 'SEND_TO_USER_INBOX':
      return { kind: 'awaiting_user', progress: { ...p, uploadedAt: now.toISOString() }, externalPostId: null, permalink: null };
    case 'PUBLISH_COMPLETE': {
      const id = r.data.publicaly_available_post_id?.[0];
      if (id == null) return { kind: 'awaiting_user', progress: { ...p, uploadedAt: now.toISOString() }, externalPostId: null, permalink: null };
      return { kind: 'published', progress: p, externalPostId: String(id), permalink: null };
    }
    case 'FAILED': {
      const reason: string = r.data.fail_reason ?? 'desconhecido';
      if (reason === 'internal') throw new TransientError('TikTok: erro interno', 'O TikTok teve um erro interno. Vamos tentar de novo.');
      throw new PermanentError(`TikTok FAILED: ${reason}`, FAIL_REASONS[reason] ?? `O TikTok recusou o vídeo (${reason}).`);
    }
    default:
      return { kind: 'progress', status: 'processing', progress: p };
  }
}

export function tiktokAdapter(cfg: TtConfig): PlatformAdapter {
  return {
    platform: 'tiktok',
    formats: ['tiktok_video'],
    validate: validateTikTok,
    advance,
    fetchAccountMetrics: (a, d) => ttAccountMetrics(a, d.fetch),
    fetchPostMetrics: (a, ids, d) => ttPostMetrics(a, ids, d.fetch),
    listRecentPosts: (a, since, d) => ttRecentPosts(a, since, d.fetch),
    refreshToken: async (tokens, d) => {
      if (!tokens.refreshToken) throw new PermanentError('TikTok sem refresh token', 'Volte a ligar a conta TikTok.');
      return ttRefreshToken(cfg, tokens.refreshToken, d);
    },
    authorizeUrl: (state, redirectUri) => ttAuthorizeUrl(cfg, state, redirectUri),
    exchangeCode: (code, redirectUri, d) => ttExchangeCode(cfg, code, redirectUri, d),
  };
}
