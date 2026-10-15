import type { ServerEnv } from '@/lib/env';
import { fakeAdapter } from './fake';
import { instagramAdapter } from './instagram/adapter';
import { tiktokAdapter } from './tiktok/adapter';
import type { Platform, PlatformAdapter } from './types';
import { youtubeAdapter } from './youtube/adapter';

export function getAdapters(env: ServerEnv): Record<Platform, PlatformAdapter> {
  if (env.PLATFORM_MODE === 'fake') {
    return { instagram: fakeAdapter('instagram'), tiktok: fakeAdapter('tiktok'), youtube: fakeAdapter('youtube') };
  }
  return {
    instagram: instagramAdapter({ appId: env.IG_APP_ID!, appSecret: env.IG_APP_SECRET!, apiVersion: env.IG_API_VERSION }),
    tiktok: tiktokAdapter({ clientKey: env.TIKTOK_CLIENT_KEY!, clientSecret: env.TIKTOK_CLIENT_SECRET! }),
    youtube: youtubeAdapter({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      uploadUnits: env.YT_UPLOAD_UNITS,
      dailyUnits: env.YT_DAILY_UNITS,
    }),
  };
}
