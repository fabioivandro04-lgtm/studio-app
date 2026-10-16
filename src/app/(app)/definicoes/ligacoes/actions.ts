'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/clients';

export async function revokeClaudeGrant(clientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!clientId) return { ok: false, error: 'Ligação inválida.' };
  const db = await createServerClient();
  const { error } = await db.auth.oauth.revokeGrant({ clientId });
  if (error) return { ok: false, error: 'Não foi possível cortar o acesso. Tente de novo.' };
  revalidatePath('/definicoes/ligacoes');
  return { ok: true };
}
