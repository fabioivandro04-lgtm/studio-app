'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/clients';
import { safeNext } from '@/lib/auth/next';
import { serverEnv } from '@/lib/env';

export interface LoginState {
  ok?: boolean;
  error?: string;
  message?: string;
}


export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().email().safeParse(form.get('email'));
  if (!email.success) return { error: 'Escreva um email válido.' };
  const supabase = await createServerClient();
  const next = safeNext(form.get('next'));
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${serverEnv().APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  // Mesma resposta exista ou não a conta, para não revelar emails.
  if (error && error.status !== 400 && error.status !== 422) return { error: 'Não foi possível enviar o link. Tente de novo.' };
  return { ok: true, message: 'Se o email tiver acesso, vai receber um link para entrar. Verifique a caixa de entrada.' };
}

export async function signInWithPassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!serverEnv().NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN) return { error: 'Entrada com palavra-passe desativada.' };
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  });
  if (error) return { error: 'Email ou palavra-passe incorretos.' };
  redirect(safeNext(form.get('next')));
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
