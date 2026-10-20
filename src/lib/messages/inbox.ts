import type { SupabaseClient } from '@supabase/supabase-js';
import { instagramAccess } from '@/lib/db/repo/instagram-access';
import { serverEnv } from '@/lib/env';
import { getMessaging } from './registry';
import type { DmConversation, DmConversationSummary } from './types';

export interface InboxAccount {
  id: string;
  brandId: string;
  handle: string;
}

export interface InboxEntry extends DmConversationSummary {
  accountId: string;
  accountHandle: string;
}

export interface Inbox {
  accounts: InboxAccount[];
  conversations: InboxEntry[];
  /** Contas cujas mensagens não se conseguiram ler, com o motivo (pt-PT). */
  errors: { handle: string; message: string }[];
}

const userMessage = (e: unknown, fallback: string) => (e as { userMessage?: string }).userMessage ?? fallback;

/** Conversas de todas as contas de Instagram ativas da marca (ou de todas as marcas), mais recentes primeiro. */
export async function loadInbox(db: SupabaseClient, brandId: string | null): Promise<Inbox> {
  let q = db.from('social_accounts').select('id, brand_id, handle').eq('platform', 'instagram').eq('status', 'active');
  if (brandId) q = q.eq('brand_id', brandId);
  const { data } = await q.order('handle');
  const accounts: InboxAccount[] = (data ?? []).map((a) => ({ id: a.id, brandId: a.brand_id, handle: a.handle }));
  const messaging = getMessaging(serverEnv());
  const errors: Inbox['errors'] = [];
  const lists = await Promise.all(
    accounts.map(async (acc): Promise<InboxEntry[]> => {
      try {
        const access = await instagramAccess(db, acc.id);
        if (!access) return [];
        const list = await messaging.listConversations(access, { fetch });
        return list.map((c) => ({ ...c, accountId: acc.id, accountHandle: acc.handle }));
      } catch (e) {
        errors.push({ handle: acc.handle, message: userMessage(e, 'Não foi possível ler as mensagens.') });
        return [];
      }
    }),
  );
  const conversations = lists.flat().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return { accounts, conversations, errors };
}

export type ConversationResult = { ok: true; conversation: DmConversation } | { ok: false; error: string };

export async function loadConversation(db: SupabaseClient, accountId: string, conversationId: string): Promise<ConversationResult> {
  try {
    const access = await instagramAccess(db, accountId);
    if (!access) return { ok: false, error: 'Esta conta já não está ligada.' };
    const conversation = await getMessaging(serverEnv()).getConversation(access, conversationId, { fetch });
    return conversation ? { ok: true, conversation } : { ok: false, error: 'Conversa não encontrada.' };
  } catch (e) {
    return { ok: false, error: userMessage(e, 'Não foi possível abrir a conversa.') };
  }
}
