'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { aiSetup, fail, toBrandAi, type Fail } from '@/lib/ai/context';
import { runReply } from '@/lib/ai/service';
import { createServerClient } from '@/lib/db/clients';
import { instagramAccess } from '@/lib/db/repo/instagram-access';
import { serverEnv } from '@/lib/env';
import { getMessaging } from '@/lib/messages/registry';
import { COMMENT_MAX_CHARS, DM_MAX_BYTES } from '@/lib/messages/types';
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

const errorText = (e: unknown, fallback: string) => (e as { userMessage?: string }).userMessage ?? fallback;

/** Marca da conta de Instagram (via RLS) e dependências da IA. */
async function aiForAccount(accountId: string) {
  const db = await createServerClient();
  const { data: acc } = await db.from('social_accounts').select('brand_id').eq('id', accountId).maybeSingle();
  if (!acc) return null;
  const setup = await aiSetup(acc.brand_id);
  const access = await instagramAccess(setup.db, accountId);
  return access ? { ...setup, access } : null;
}

export type SuggestResult = { ok: true; text: string } | Fail;

/** Resposta da IA para a conversa (o texto fica na caixa; quem envia é a pessoa). */
export async function suggestDmReply(raw: { accountId: string; conversationId: string }): Promise<SuggestResult> {
  const parsed = z.object({ accountId: z.guid(), conversationId: z.string().min(1).max(200) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Conversa inválida.' };
  try {
    const ctx = await aiForAccount(parsed.data.accountId);
    if (!ctx) return { ok: false, error: 'Esta conta já não está ligada.' };
    const conv = await getMessaging(serverEnv()).getConversation(ctx.access, parsed.data.conversationId, { fetch });
    if (!conv) return { ok: false, error: 'Conversa não encontrada.' };
    const text = await runReply(ctx.deps, {
      brandId: ctx.brand.id, brand: toBrandAi(ctx.brand), knowledge: ctx.brand.replyKnowledge, channel: 'dm',
      customer: conv.customer.username, turns: conv.messages.map((m) => ({ fromBusiness: m.fromBusiness, text: m.text || (m.story === 'reply' ? '(respondeu a uma story)' : '') })),
    });
    return { ok: true, text };
  } catch (e) {
    if ((e as { userMessage?: string }).userMessage) return { ok: false, error: errorText(e, '') };
    return fail(e);
  }
}

const commentInput = z.object({ accountId: z.guid(), commentId: z.string().regex(/^[0-9A-Za-z_-]{1,64}$/) });

export async function suggestCommentReply(raw: { accountId: string; commentId: string }): Promise<SuggestResult> {
  const parsed = commentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Comentário inválido.' };
  try {
    const ctx = await aiForAccount(parsed.data.accountId);
    if (!ctx) return { ok: false, error: 'Esta conta já não está ligada.' };
    const found = await getMessaging(serverEnv()).getComment(ctx.access, parsed.data.commentId, { fetch });
    if (!found) return { ok: false, error: 'Comentário não encontrado.' };
    const { comment, postCaption } = found;
    const text = await runReply(ctx.deps, {
      brandId: ctx.brand.id, brand: toBrandAi(ctx.brand), knowledge: ctx.brand.replyKnowledge, channel: 'comment',
      customer: comment.username, postCaption,
      turns: [{ fromBusiness: false, text: comment.text }, ...comment.replies.map((r) => ({ fromBusiness: r.fromBusiness, text: r.text }))],
    });
    return { ok: true, text };
  } catch (e) {
    if ((e as { userMessage?: string }).userMessage) return { ok: false, error: errorText(e, '') };
    return fail(e);
  }
}

export async function replyToComment(raw: { accountId: string; commentId: string; text: string }): Promise<SendResult> {
  const parsed = commentInput.extend({ text: z.string().trim().min(1, 'Escreva uma resposta.').max(COMMENT_MAX_CHARS, 'A resposta é demasiado longa.') }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Resposta inválida.' };
  const db = await createServerClient();
  try {
    const access = await instagramAccess(db, parsed.data.accountId);
    if (!access) return { ok: false, error: 'Esta conta já não está ligada.' };
    await getMessaging(serverEnv()).replyToComment(access, parsed.data.commentId, parsed.data.text, { fetch });
  } catch (e) {
    return { ok: false, error: errorText(e, 'Não foi possível responder ao comentário.') };
  }
  revalidatePath('/mensagens');
  return { ok: true };
}

/** Esconde (ou volta a mostrar) um comentário: deixa de ser visível para os outros, mas a pessoa continua a vê-lo. */
export async function hideComment(raw: { accountId: string; commentId: string; hide: boolean }): Promise<SendResult> {
  const parsed = commentInput.extend({ hide: z.boolean() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Comentário inválido.' };
  const db = await createServerClient();
  try {
    const access = await instagramAccess(db, parsed.data.accountId);
    if (!access) return { ok: false, error: 'Esta conta já não está ligada.' };
    await getMessaging(serverEnv()).hideComment(access, parsed.data.commentId, parsed.data.hide, { fetch });
  } catch (e) {
    return { ok: false, error: errorText(e, 'Não foi possível esconder o comentário.') };
  }
  revalidatePath('/mensagens');
  return { ok: true };
}
