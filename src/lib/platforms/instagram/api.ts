import { requestJson } from '../http';

export interface IgConfig {
  appId: string;
  appSecret: string;
  apiVersion: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function igApi(cfg: IgConfig, fetchFn: typeof fetch, token: string) {
  const base = `https://graph.instagram.com/${cfg.apiVersion}`;
  return {
    base,
    async get<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
      const qs = new URLSearchParams({ ...params, access_token: token });
      return (await requestJson<T>(fetchFn, `${base}${path}?${qs}`, { platform: 'instagram' })).body;
    },
    async post<T = any>(path: string, params: Record<string, string | undefined>): Promise<T> {
      const body = new URLSearchParams({ access_token: token });
      for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, v);
      return (await requestJson<T>(fetchFn, `${base}${path}`, { platform: 'instagram', method: 'POST', body })).body;
    },
  };
}
