import { AuthError, PermanentError } from '@/lib/platforms/errors';
import { requestJson } from '@/lib/platforms/http';
import type { AdAccountInfo, AdInsights, AdsClient, AdStats, CampaignStats } from './types';

export interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  apiVersion: string;
}

const SCOPES = ['ads_read'];
const STATS_FIELDS = 'spend,impressions,reach,inline_link_clicks,actions';
const LEAD_ACTIONS = new Set(['lead', 'onsite_conversion.lead_grouped']);
const CONVERSATION_ACTIONS = new Set(['onsite_conversion.messaging_conversation_started_7d']);

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));

function sumActions(actions: any[] | undefined, types: Set<string>): number {
  // A Meta repete o mesmo resultado com nomes diferentes: conta-se o maior, não a soma.
  return Math.max(0, ...(actions ?? []).filter((a) => types.has(a.action_type)).map((a) => num(a.value)));
}

export function parseStats(row: any): AdStats {
  return {
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    linkClicks: num(row?.inline_link_clicks),
    leads: sumActions(row?.actions, LEAD_ACTIONS),
    conversations: sumActions(row?.actions, CONVERSATION_ACTIONS),
  };
}

const EMPTY: AdStats = { spend: 0, impressions: 0, reach: 0, linkClicks: 0, leads: 0, conversations: 0 };

async function graph<T = any>(cfg: MetaAdsConfig, fetchFn: typeof fetch, path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params);
  try {
    return (await requestJson<T>(fetchFn, `https://graph.facebook.com/${cfg.apiVersion}${path}?${qs}`, { platform: 'instagram' })).body;
  } catch (e) {
    // requestJson fala do "Instagram"; aqui a ligação é a conta de anúncios (login pelo Facebook).
    if (e instanceof AuthError) throw new AuthError(e.message, 'A ligação aos anúncios da Meta expirou. Volte a ligar em Definições → Contas ligadas.');
    if (e instanceof PermanentError && /\(#(10|200|272|294)\)/.test(e.message)) {
      throw new PermanentError(e.message, 'Sem acesso a esta conta de anúncios. Confirme que é administrador dela e volte a ligar.');
    }
    throw e;
  }
}

export function metaAdsClient(cfg: MetaAdsConfig): AdsClient {
  return {
    authorizeUrl(state, redirectUri) {
      const qs = new URLSearchParams({ client_id: cfg.appId, redirect_uri: redirectUri, state, scope: SCOPES.join(','), response_type: 'code' });
      return `https://www.facebook.com/${cfg.apiVersion}/dialog/oauth?${qs}`;
    },

    async exchangeCode(code, redirectUri, deps) {
      const short = await graph<{ access_token: string }>(cfg, deps.fetch, '/oauth/access_token', {
        client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: redirectUri, code,
      });
      // Token de longa duração (cerca de 60 dias). A Meta não dá refresh token: no fim volta-se a ligar.
      const long = await graph<{ access_token: string; expires_in?: number }>(cfg, deps.fetch, '/oauth/access_token', {
        grant_type: 'fb_exchange_token', client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: short.access_token,
      });
      const res = await graph(cfg, deps.fetch, '/me/adaccounts', {
        fields: 'account_id,name,currency,account_status', limit: '50', access_token: long.access_token,
      });
      const accounts: AdAccountInfo[] = (res.data ?? [])
        // 1 = ativa; 2 = desativada; 101 = fechada. As restantes (pagamento em falta, em revisão) continuam a ter resultados.
        .filter((a: any) => a.account_status !== 2 && a.account_status !== 101)
        .map((a: any) => ({ externalId: String(a.account_id), name: a.name || `Conta ${a.account_id}`, currency: a.currency || 'EUR' }));
      return {
        accessToken: long.access_token,
        expiresAt: long.expires_in ? new Date(deps.now().getTime() + long.expires_in * 1000) : null,
        accounts,
      };
    },

    async insights(accessToken, accountId, since, until, deps) {
      const base = { access_token: accessToken, time_range: JSON.stringify({ since, until }) };
      const [account, byCampaign] = await Promise.all([
        graph(cfg, deps.fetch, `/act_${accountId}/insights`, { ...base, level: 'account', fields: STATS_FIELDS }),
        graph(cfg, deps.fetch, `/act_${accountId}/insights`, { ...base, level: 'campaign', fields: `campaign_id,campaign_name,${STATS_FIELDS}`, limit: '100' }),
      ]);
      const campaigns: CampaignStats[] = (byCampaign.data ?? [])
        .map((r: any) => ({ id: String(r.campaign_id), name: r.campaign_name ?? 'Sem nome', ...parseStats(r) }))
        .sort((a: CampaignStats, b: CampaignStats) => b.spend - a.spend);
      const totals = account.data?.[0] ? parseStats(account.data[0]) : EMPTY;
      return { totals, campaigns } satisfies AdInsights;
    },
  };
}
