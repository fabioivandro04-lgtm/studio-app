import { describe, expect, it } from 'vitest';
import { AuthError } from '@/lib/platforms/errors';
import { fakeFetch, jsonResponse } from '@/lib/platforms/testing/fake-fetch';
import { metaAdsClient, parseStats } from './meta';

const NOW = new Date('2026-10-20T10:00:00Z');
const client = metaAdsClient({ appId: 'fbapp', appSecret: 'sec', apiVersion: 'v23.0' });

describe('anúncios da Meta', () => {
  it('authorizeUrl pede só ads_read pelo login do Facebook', () => {
    const u = new URL(client.authorizeUrl('st', 'https://app/cb'));
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v23.0/dialog/oauth');
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: 'fbapp', redirect_uri: 'https://app/cb', state: 'st', scope: 'ads_read', response_type: 'code' });
  });

  it('exchangeCode troca por token longo e lista as contas ativas', async () => {
    const fetch = fakeFetch([
      ['GET', /oauth\/access_token\?.*code=CODE/, (c) => {
        expect(c.params).toMatchObject({ client_id: 'fbapp', client_secret: 'sec', redirect_uri: 'https://app/cb' });
        return { access_token: 'short' };
      }],
      ['GET', /oauth\/access_token\?.*fb_exchange_token=short/, () => ({ access_token: 'long', expires_in: 5184000 })],
      ['GET', /\/me\/adaccounts\?/, (c) => {
        expect(c.params.access_token).toBe('long');
        return { data: [
          { account_id: '111', name: 'Unidreamity', currency: 'EUR', account_status: 1 },
          { account_id: '222', name: 'Antiga', currency: 'EUR', account_status: 101 },
          { account_id: '333', name: '', currency: 'USD', account_status: 3 },
        ] };
      }],
    ]);
    const r = await client.exchangeCode('CODE', 'https://app/cb', { fetch, now: () => NOW });
    expect(r).toEqual({
      accessToken: 'long',
      expiresAt: new Date('2026-12-19T10:00:00Z'),
      accounts: [{ externalId: '111', name: 'Unidreamity', currency: 'EUR' }, { externalId: '333', name: 'Conta 333', currency: 'USD' }],
    });
  });

  it('insights: totais da conta e campanhas por gasto', async () => {
    const fetch = fakeFetch([
      ['GET', /act_111\/insights\?.*level=account/, (c) => {
        expect(JSON.parse(String(c.params.time_range))).toEqual({ since: '2026-09-20', until: '2026-10-20' });
        return { data: [{ spend: '30.50', impressions: '9000', reach: '5000', inline_link_clicks: '120', actions: [{ action_type: 'lead', value: '4' }] }] };
      }],
      ['GET', /act_111\/insights\?.*level=campaign/, () => ({ data: [
        { campaign_id: 'a', campaign_name: 'Pequena', spend: '5', reach: '800' },
        { campaign_id: 'b', campaign_name: 'Grande', spend: '25.5', reach: '4500', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '7' }] },
      ] })],
    ]);
    const r = await client.insights('tok', '111', '2026-09-20', '2026-10-20', { fetch });
    expect(r.totals).toEqual({ spend: 30.5, impressions: 9000, reach: 5000, linkClicks: 120, leads: 4, conversations: 0 });
    expect(r.campaigns.map((c) => [c.name, c.spend, c.conversations])).toEqual([['Grande', 25.5, 7], ['Pequena', 5, 0]]);
  });

  it('leads repetidos com outro nome contam uma vez', () => {
    expect(parseStats({ actions: [{ action_type: 'lead', value: '3' }, { action_type: 'onsite_conversion.lead_grouped', value: '3' }] }).leads).toBe(3);
  });

  it('token expirado pede para voltar a ligar os anúncios', async () => {
    const fetch = fakeFetch([['GET', /insights/, () => jsonResponse(400, { error: { code: 190, message: 'Session has expired' } })]]);
    const err = await client.insights('tok', '111', '2026-09-20', '2026-10-20', { fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.userMessage).toContain('anúncios da Meta');
  });
});
