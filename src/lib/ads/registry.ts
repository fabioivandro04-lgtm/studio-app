import type { ServerEnv } from '@/lib/env';
import { PermanentError } from '@/lib/platforms/errors';
import { metaAdsClient } from './meta';
import type { AdsClient } from './types';

const NOT_CONFIGURED = 'Os anúncios da Meta ainda não estão configurados nesta app (META_APP_ID e META_APP_SECRET, ver docs/SETUP.md).';

export function getAdsClient(env: ServerEnv): AdsClient {
  if (env.PLATFORM_MODE === 'fake') return fakeAdsClient();
  if (env.META_APP_ID && env.META_APP_SECRET) {
    return metaAdsClient({ appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, apiVersion: env.IG_API_VERSION });
  }
  const fail = async (): Promise<never> => {
    throw new PermanentError(NOT_CONFIGURED);
  };
  return {
    authorizeUrl: () => {
      throw new PermanentError(NOT_CONFIGURED);
    },
    exchangeCode: fail,
    insights: fail,
  };
}

/** Anúncios falsos para desenvolvimento e e2e (PLATFORM_MODE=fake). */
function fakeAdsClient(): AdsClient {
  const stats = (k: number) => ({ spend: 12.5 * k, impressions: 4000 * k, reach: 2500 * k, linkClicks: 60 * k, leads: 3 * k, conversations: 5 * k });
  return {
    authorizeUrl: (state, redirectUri) => `${redirectUri}?code=fake&state=${encodeURIComponent(state)}`,
    async exchangeCode(_code, _redirectUri, deps) {
      return {
        accessToken: 'fake-token-meta-ads',
        expiresAt: new Date(deps.now().getTime() + 60 * 86_400_000),
        accounts: [{ externalId: '1234567890', name: 'Conta de anúncios de teste', currency: 'EUR' }],
      };
    },
    async insights() {
      return {
        totals: stats(3),
        campaigns: [{ id: 'c1', name: 'Inscrições outubro', ...stats(2) }, { id: 'c2', name: 'Seguidores', ...stats(1) }],
      };
    },
  };
}
