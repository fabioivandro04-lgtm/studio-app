import { requestJson } from '../http';

export interface TtConfig {
  clientKey: string;
  clientSecret: string;
}

export const TT_BASE = 'https://open.tiktokapis.com/v2';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ttApi(fetchFn: typeof fetch, token: string) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };
  return {
    async get<T = any>(path: string, query: Record<string, string> = {}): Promise<T> {
      const qs = new URLSearchParams(query);
      return (await requestJson<T>(fetchFn, `${TT_BASE}${path}?${qs}`, { platform: 'tiktok', headers })).body;
    },
    async post<T = any>(path: string, body: unknown, query: Record<string, string> = {}): Promise<T> {
      const qs = new URLSearchParams(query).toString();
      const url = `${TT_BASE}${path}${qs ? `?${qs}` : ''}`;
      return (await requestJson<T>(fetchFn, url, { platform: 'tiktok', method: 'POST', headers, body: JSON.stringify(body) })).body;
    },
  };
}
