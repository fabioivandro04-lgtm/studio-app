'use server';

import { PasswordChange } from '@/lib/auth/password';
import { createServerClient } from '@/lib/db/clients';

export interface PasswordState {
  ok?: boolean;
  error?: string;
}

export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const parsed = PasswordChange.safeParse({ password: form.get('password'), confirm: form.get('confirm') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const db = await createServerClient();
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error?.code === 'same_password') return { error: 'Escolha uma palavra-passe diferente da atual.' };
  if (error?.code === 'weak_password') return { error: 'Palavra-passe demasiado fraca. Use mais caracteres.' };
  if (error) return { error: 'Não foi possível mudar a palavra-passe. Tente de novo.' };
  return { ok: true };
}
