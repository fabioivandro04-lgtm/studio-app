import type { AuthInfo } from '@modelcontextprotocol/server';
import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';

export interface AuthDeps {
  /** Claims do JWT se a assinatura e a validade estiverem certas; null caso contrário. */
  getClaims(token: string): Promise<Record<string, unknown> | null>;
  /** O utilizador do token é o dono da app? (RLS: só o dono vê a sua linha em app_owner). */
  isOwner(token: string, sub: string): Promise<boolean>;
}

const tokenClient = (token: string) =>
  createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

const supabaseDeps: AuthDeps = {
  async getClaims(token) {
    const { data, error } = await tokenClient(token).auth.getClaims(token);
    return error || !data ? null : (data.claims as Record<string, unknown>);
  },
  async isOwner(token, sub) {
    const { data } = await tokenClient(token).from('app_owner').select('user_id').eq('user_id', sub).maybeSingle();
    return !!data;
  },
};

/** Aceita só tokens OAuth (claim client_id) do dono do Estúdio. */
export async function verifyMcpToken(_req: Request, bearer?: string, deps: AuthDeps = supabaseDeps): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const claims = await deps.getClaims(bearer).catch(() => null);
  const sub = typeof claims?.sub === 'string' ? claims.sub : null;
  const clientId = typeof claims?.client_id === 'string' ? claims.client_id : null;
  if (!sub || !clientId) return undefined;
  if (!(await deps.isOwner(bearer, sub).catch(() => false))) return undefined;
  return { token: bearer, clientId, scopes: [], ...(typeof claims?.exp === 'number' ? { expiresAt: claims.exp } : {}), extra: { userId: sub } };
}

export { tokenClient };
