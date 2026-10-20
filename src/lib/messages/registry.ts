import type { ServerEnv } from '@/lib/env';
import { PermanentError } from '@/lib/platforms/errors';
import { instagramMessaging } from '@/lib/platforms/instagram/messages';
import { fakeMessaging } from './fake';
import type { MessagingClient } from './types';

export function getMessaging(env: ServerEnv): MessagingClient {
  if (env.PLATFORM_MODE === 'fake') return fakeMessaging();
  if (env.IG_APP_ID && env.IG_APP_SECRET) {
    return instagramMessaging({ appId: env.IG_APP_ID, appSecret: env.IG_APP_SECRET, apiVersion: env.IG_API_VERSION });
  }
  const fail = async (): Promise<never> => {
    throw new PermanentError('O Instagram ainda não está configurado nesta app (ver docs/SETUP.md).');
  };
  return { listConversations: fail, getConversation: fail, send: fail };
}
