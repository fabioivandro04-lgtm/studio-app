import type { DmAccount, DmAttachment, DmConversation, DmConversationSummary, DmMessage, MessagingClient } from '@/lib/messages/types';
import { PermanentError } from '../errors';
import { igApi, type IgConfig } from './api';

const MESSAGE_FIELDS = 'id,created_time,from,message,attachments,story,is_unsupported';

/* eslint-disable @typescript-eslint/no-explicit-any */
function isBusiness(account: DmAccount, from: any): boolean {
  return String(from?.id ?? '') === account.externalId || (!!from?.username && from.username === account.handle);
}

function attachments(m: any): DmAttachment[] {
  return (m.attachments?.data ?? []).flatMap((a: any): DmAttachment[] => {
    if (a.image_data?.url) return [{ kind: 'image', url: a.image_data.url }];
    if (a.video_data?.url) return [{ kind: 'video', url: a.video_data.url }];
    if (a.file_url) return [{ kind: 'file', url: a.file_url }];
    return [];
  });
}

export function parseMessage(account: DmAccount, m: any): DmMessage {
  return {
    id: String(m.id),
    createdAt: new Date(m.created_time),
    fromBusiness: isBusiness(account, m.from),
    text: m.message ?? '',
    attachments: attachments(m),
    story: m.story?.mention ? 'mention' : m.story?.reply_to ? 'reply' : null,
    unsupported: m.is_unsupported === true,
  };
}

function parseConversation(account: DmAccount, c: any): DmConversation {
  const people: any[] = c.participants?.data ?? [];
  const other = people.find((p) => !isBusiness(account, p)) ?? {};
  const messages = (c.messages?.data ?? []).map((m: any) => parseMessage(account, m));
  // A API devolve as mais recentes primeiro.
  messages.sort((a: DmMessage, b: DmMessage) => a.createdAt.getTime() - b.createdAt.getTime());
  const last = messages.at(-1) ?? null;
  return {
    id: String(c.id),
    updatedAt: c.updated_time ? new Date(c.updated_time) : (last?.createdAt ?? new Date(0)),
    customer: { id: String(other.id ?? ''), username: other.username ?? 'desconhecido' },
    last,
    messages,
  };
}

// Erros da Graph API quando a app não tem a permissão de mensagens (#3, #10, #200, #230).
const NO_PERMISSION = /\(#(3|10|200|230)\)/;
// Fora da janela de 24 h (subcódigo 2534022) ou destinatário indisponível.
const OUTSIDE_WINDOW = /2534022|outside of allowed window|fora da janela/i;

/** Erro de permissão em falta: a conta tem de ser religada para dar acesso às mensagens. */
export class MessagesPermissionError extends PermanentError {
  constructor(detail: string) {
    super(`Instagram: sem permissão de mensagens (${detail})`, 'Para ver as mensagens, volte a ligar a conta do Instagram em Definições → Contas ligadas.');
  }
}

async function translate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof PermanentError)) throw e;
    if (OUTSIDE_WINDOW.test(e.message)) {
      throw new PermanentError(e.message, 'Já passaram mais de 24 h desde a última mensagem do cliente: o Instagram não deixa responder pela app. Responda no telemóvel.');
    }
    if (NO_PERMISSION.test(e.message)) throw new MessagesPermissionError(e.message);
    throw e;
  }
}

export function instagramMessaging(cfg: IgConfig): MessagingClient {
  return {
    async listConversations(account, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      const res = await translate(() =>
        api.get('/me/conversations', {
          platform: 'instagram',
          fields: `id,updated_time,participants,messages.limit(1){${MESSAGE_FIELDS}}`,
          limit: '50',
        }),
      );
      return (res.data ?? []).map((c: any): DmConversationSummary => {
        const { messages: _m, ...summary } = parseConversation(account, c);
        return summary;
      });
    },

    async getConversation(account, conversationId, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      const c = await translate(() =>
        api.get(`/${encodeURIComponent(conversationId)}`, { fields: `id,updated_time,participants,messages.limit(20){${MESSAGE_FIELDS}}` }),
      );
      return c?.id ? parseConversation(account, c) : null;
    },

    async send(account, recipientId, text, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      await translate(() =>
        api.post(`/${account.externalId}/messages`, {
          recipient: JSON.stringify({ id: recipientId }),
          message: JSON.stringify({ text }),
        }),
      );
    },
  };
}
