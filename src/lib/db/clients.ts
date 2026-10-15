import { cache } from 'react';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';

/** Cliente com a sessão do utilizador (RLS). Um por pedido (cache do React): layout e página partilham-no. */
export const createServerClient = cache(async function createServerClient(): Promise<SupabaseClient> {
  const env = serverEnv();
  const store = await cookies();
  return createSsrClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Chamado num Server Component: o proxy trata da renovação da sessão.
        }
      },
    },
  });
});

/** Cliente de serviço (ignora RLS). Só no servidor: cron, OAuth e operações com tokens. */
export function createServiceClient(): SupabaseClient {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY em falta: adicione-a nas variáveis de ambiente (ver docs/SETUP.md).');
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
