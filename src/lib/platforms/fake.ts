import { PermanentError } from './errors';
import type { Platform, PlatformAdapter } from './types';
import { VALIDATORS } from './validate';

const FORMATS = {
  instagram: ['ig_image', 'ig_carousel', 'ig_reel', 'ig_story'],
  tiktok: ['tiktok_video'],
  youtube: ['yt_short'],
} as const;

/** Adaptador falso para desenvolvimento e testes e2e (PLATFORM_MODE=fake). Não contacta nenhuma rede. */
export function fakeAdapter(platform: Platform): PlatformAdapter {
  return {
    platform,
    formats: [...FORMATS[platform]],
    validate: VALIDATORS[platform],
    async advance(t, _account, deps) {
      if (t.options.fake === 'fail_permanent') {
        throw new PermanentError('fake: falha definitiva', 'Falha simulada (modo de testes).');
      }
      if (!t.progress.step) {
        return { kind: 'progress', status: 'processing', progress: { step: 'processing', startedAt: deps.now().toISOString() } };
      }
      const id = `fake-${platform}-${t.id}`;
      if (platform === 'instagram') {
        return { kind: 'published', progress: t.progress, externalPostId: id, permalink: `https://example.com/${id}` };
      }
      return {
        kind: 'awaiting_user',
        progress: { ...t.progress, uploadedAt: deps.now().toISOString() },
        externalPostId: platform === 'youtube' ? id : null,
        permalink: platform === 'youtube' ? `https://youtube.com/shorts/${id}` : null,
      };
    },
    async fetchAccountMetrics() {
      return { followers: 1000, views: 5000, raw: { fake: true } };
    },
    async fetchPostMetrics(_a, ids) {
      return Object.fromEntries(
        ids.map((id, i) => [id, { views: 100 * (i + 1), reach: 80 * (i + 1), likes: 10 * (i + 1), comments: i, shares: i, saves: i, watchTimeS: null, isPublic: true, raw: { fake: true } }]),
      );
    },
    async listRecentPosts(_a, since) {
      const createdAt = new Date(since.getTime() + 60_000);
      return [{ externalId: `fake-recent-${platform}`, createdAt, permalink: `https://example.com/fake-recent-${platform}`, thumbnailUrl: null, title: 'Vídeo de teste' }];
    },
    async refreshToken(tokens, deps) {
      return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: new Date(deps.now().getTime() + 86_400_000), refreshExpiresAt: null, scopes: [] };
    },
    authorizeUrl(state, redirectUri) {
      return `${redirectUri}?code=fake&state=${encodeURIComponent(state)}`;
    },
    async exchangeCode(_code, _redirectUri, deps) {
      return {
        tokens: { accessToken: `fake-token-${platform}`, refreshToken: `fake-refresh-${platform}`, expiresAt: new Date(deps.now().getTime() + 86_400_000), refreshExpiresAt: null, scopes: [] },
        profile: { externalId: `fake-${platform}`, handle: `fake_${platform}`, displayName: `Conta de teste ${platform}`, avatarUrl: null },
      };
    },
  };
}
