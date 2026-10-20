/** Anúncios da Meta (Instagram e Facebook): só leitura de resultados. */

export interface AdAccountInfo {
  /** Id sem o prefixo "act_". */
  externalId: string;
  name: string;
  currency: string;
}

export interface AdStats {
  spend: number;
  impressions: number;
  reach: number;
  /** Cliques na ligação (site, WhatsApp, perfil…). */
  linkClicks: number;
  leads: number;
  /** Conversas iniciadas por mensagem (Instagram Direct, Messenger, WhatsApp). */
  conversations: number;
}

export interface CampaignStats extends AdStats {
  id: string;
  name: string;
}

export interface AdInsights {
  totals: AdStats;
  /** Mais gasto primeiro. */
  campaigns: CampaignStats[];
}

export interface AdsConnection {
  accessToken: string;
  expiresAt: Date | null;
  accounts: AdAccountInfo[];
}

export interface AdsClient {
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string, deps: { fetch: typeof fetch; now(): Date }): Promise<AdsConnection>;
  /** `since`/`until` em yyyy-MM-dd (inclusive). */
  insights(accessToken: string, accountId: string, since: string, until: string, deps: { fetch: typeof fetch }): Promise<AdInsights>;
}
