import type { ServerEnv } from '@/lib/env';
import { fakeAdapter } from './fake';
import { instagramAdapter } from './instagram/adapter';
import { tiktokAdapter } from './tiktok/adapter';
import { PermanentError } from './errors';
import { PLATFORM_LABEL, type Platform, type PlatformAdapter } from './types';
import { VALIDATORS } from './validate';
import { youtubeAdapter } from './youtube/adapter';

export function getAdapters(env: ServerEnv): Record<Platform, PlatformAdapter> {
  if (env.PLATFORM_MODE === 'fake') {
    return { instagram: fakeAdapter('instagram'), tiktok: fakeAdapter('tiktok'), youtube: fakeAdapter('youtube') };
  }
  return {
    instagram:
      env.IG_APP_ID && env.IG_APP_SECRET
        ? instagramAdapter({ appId: env.IG_APP_ID, appSecret: env.IG_APP_SECRET, apiVersion: env.IG_API_VERSION })
        : unconfiguredAdapter('instagram'),
    tiktok:
      env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET
        ? tiktokAdapter({ clientKey: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET })
        : unconfiguredAdapter('tiktok'),
    youtube:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? youtubeAdapter({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            uploadUnits: env.YT_UPLOAD_UNITS,
            dailyUnits: env.YT_DAILY_UNITS,
          })
        : unconfiguredAdapter('youtube'),
  };
}

/** Rede sem credenciais: valida normalmente, mas ligar/publicar dá um erro claro. */
function unconfiguredAdapter(platform: Platform): PlatformAdapter {
  const message = `O ${PLATFORM_LABEL[platform]} ainda não está configurado nesta app (ver docs/SETUP.md).`;
  const fail = async (): Promise<never> => {
    throw new PermanentError(message);
  };
  return {
    platform,
    formats: [],
    validate: VALIDATORS[platform],
    advance: fail,
    fetchAccountMetrics: fail,
    fetchPostMetrics: fail,
    listRecentPosts: fail,
    refreshToken: fail,
    exchangeCode: fail,
    authorizeUrl: () => {
      throw new PermanentError(message);
    },
  };
}
