import type {
  DmAccount, DmAttachment, DmConversation, DmConversationSummary, DmMessage, IgComment, IgCommentedPost, IgCommentReply, MessagingClient,
} from '@/lib/messages/types';
import { PermanentError } from '../errors';
import { igApi, type IgConfig } from './api';

const MESSAGE_FIELDS = 'id,created_time,from,message,attachments,story,is_unsupported';
const REPLY_FIELDS = 'id,text,username,timestamp,from';
const COMMENT_FIELDS = `${REPLY_FIELDS},hidden,replies{${REPLY_FIELDS}}`;
/** Posts recentes onde se procuram comentários. */
const RECENT_POSTS = 12;

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

function parseReply(account: DmAccount, r: any): IgCommentReply {
  const username = r.username ?? r.from?.username ?? 'desconhecido';
  return {
    id: String(r.id),
    username,
    text: r.text ?? '',
    createdAt: new Date(r.timestamp),
    fromBusiness: isBusiness(account, { id: r.from?.id, username }),
  };
}

export function parseComment(account: DmAccount, c: any): IgComment {
  const replies = (c.replies?.data ?? []).map((r: any) => parseReply(account, r));
  replies.sort((a: IgCommentReply, b: IgCommentReply) => a.createdAt.getTime() - b.createdAt.getTime());
  return { ...parseReply(account, c), hidden: c.hidden === true, replies, answered: replies.some((r: IgCommentReply) => r.fromBusiness) };
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
    super(`Instagram: sem permissão de mensagens/comentários (${detail})`, 'Para ver as mensagens e os comentários, volte a ligar a conta do Instagram em Definições → Contas ligadas.');
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

    async listComments(account, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      const media = await translate(() =>
        api.get(`/${account.externalId}/media`, { fields: 'id,caption,permalink,timestamp,media_type,media_url,thumbnail_url,comments_count', limit: String(RECENT_POSTS) }),
      );
      const withComments = (media.data ?? []).filter((m: any) => (m.comments_count ?? 0) > 0);
      return Promise.all(
        withComments.map(async (m: any): Promise<IgCommentedPost> => {
          const res = await translate(() => api.get(`/${m.id}/comments`, { fields: COMMENT_FIELDS, limit: '50' }));
          const comments = (res.data ?? [])
            .map((c: any) => parseComment(account, c))
            // Comentários da própria conta no seu post não precisam de resposta.
            .filter((c: IgComment) => !c.fromBusiness)
            .sort((a: IgComment, b: IgComment) => b.createdAt.getTime() - a.createdAt.getTime());
          return {
            id: String(m.id),
            caption: m.caption ?? '',
            permalink: m.permalink ?? null,
            thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : (m.media_url ?? null)),
            createdAt: new Date(m.timestamp),
            comments,
          };
        }),
      ).then((posts) => posts.filter((p) => p.comments.length > 0));
    },

    async getComment(account, commentId, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      const c = await translate(() => api.get(`/${encodeURIComponent(commentId)}`, { fields: `${COMMENT_FIELDS},media{caption}` }));
      return c?.id ? { comment: parseComment(account, c), postCaption: c.media?.caption ?? '' } : null;
    },

    async replyToComment(account, commentId, text, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      await translate(() => api.post(`/${encodeURIComponent(commentId)}/replies`, { message: text }));
    },

    async hideComment(account, commentId, hide, deps) {
      const api = igApi(cfg, deps.fetch, account.accessToken);
      await translate(() => api.post(`/${encodeURIComponent(commentId)}`, { hide: String(hide) }));
    },
  };
}
