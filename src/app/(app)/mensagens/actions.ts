'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerClient } from '@/lib/db/clients';
import { instagramAccess } from '@/lib/db/repo/instagram-access';
import { serverEnv } from '@/lib/env';
import { getMessaging } from '@/lib/messages/registry';
import { DM_MAX_BYTES } from '@/lib/messages/types';
import { replyWindow } from '@/lib/messages/window';

const input = z.object({
  accountId: z.guid(),
  conversationId: z.string().min(1).max(200),
  text: z.string().trim().min(1, 'Escreva uma mensagem.'),
});

export type SendResult = { ok: true } | { ok: false; error: string };

/** Responde a um cliente no Instagram (só dentro das 24 h desde a última mensagem dele). */
export async function sendMessage(raw: { accountId: string; conversationId: string; text: string }): Promise<SendResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Mensagem inválida.' };
  const { accountId, conversationId, text } = parsed.data;
  if (Buffer.byteLength(text, 'utf8') > DM_MAX_BYTES) return { ok: false, error: 'A mensagem é demasiado longa (máximo de cerca de 1000 caracteres).' };

  const db = await createServerClient();
  try {
    const access = await instagramAccess(db, accountId);
    if (!access) return { ok: false, error: 'Esta conta já não está ligada.' };
    const messaging = getMessaging(serverEnv());
    // O destinatário vem da própria conversa (não do browser) e a janela de 24 h é confirmada aqui.
    const conv = await messaging.getConversation(access, conversationId, { fetch });
    if (!conv || !conv.customer.id) return { ok: false, error: 'Conversa não encontrada.' };
    if (!replyWindow(conv.messages, new Date()).open) {
      return { ok: false, error: 'Já passaram mais de 24 h desde a última mensagem do cliente: o Instagram não deixa responder pela app. Responda no telemóvel.' };
    }
    await messaging.send(access, conv.customer.id, text, { fetch });
  } catch (e) {
    return { ok: false, error: (e as { userMessage?: string }).userMessage ?? 'Não foi possível enviar a mensagem.' };
  }
  revalidatePath('/mensagens');
  return { ok: true };
}
