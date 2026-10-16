import type { AuthInfo } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tokenClient } from './auth';
import { createServiceClient } from '@/lib/db/clients';
import { clientEnv, serverEnv } from '@/lib/env';
import { takeToken } from './rate-limit';
import { safeFetch } from '@/lib/net/safe-fetch';

export interface McpCtx {
  /** Cliente Supabase com o token do Claude: o RLS (dono + defesas de agente) aplica-se. */
  db: SupabaseClient;
  /** Cliente de serviço, só para ler/escrever ficheiros do Storage num caminho já validado. */
  svc(): SupabaseClient;
  userId: string;
  clientId: string;
  rateKey: string;
  take(key: string, now: number): boolean;
  now(): Date;
  appUrl: string;
  maxUploadMb: number;
  /** Descarrega um link público (validado contra endereços internos). */
  fetchLink(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; mime: string; name: string }>;
}

export function ctxFrom(auth: AuthInfo): McpCtx {
  return {
    db: tokenClient(auth.token),
    svc: createServiceClient,
    userId: String(auth.extra?.userId ?? ''),
    clientId: auth.clientId,
    rateKey: auth.token,
    take: takeToken,
    now: () => new Date(),
    appUrl: serverEnv().APP_URL,
    maxUploadMb: clientEnv.maxUploadMb,
    fetchLink: (url, max) => safeFetch(url, max),
  };
}
