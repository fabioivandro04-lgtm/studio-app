import type { AccountCtx } from '@/lib/platforms/types';

/** Mensagens diretas (só Instagram: o TikTok não dá acesso às mensagens a partir da Europa). */

export interface DmAttachment {
  kind: 'image' | 'video' | 'file';
  url: string;
}

export interface DmMessage {
  id: string;
  createdAt: Date;
  /** Mensagem enviada pela própria conta (não pelo cliente). */
  fromBusiness: boolean;
  text: string;
  attachments: DmAttachment[];
  /** Resposta a uma story, ou menção numa story. */
  story: 'reply' | 'mention' | null;
  /** Conteúdo que a API não mostra (ex.: publicações partilhadas, áudio). */
  unsupported: boolean;
}

export interface DmCustomer {
  /** IGSID: o id do cliente para responder. */
  id: string;
  username: string;
}

export interface DmConversationSummary {
  id: string;
  updatedAt: Date;
  customer: DmCustomer;
  last: DmMessage | null;
}

export interface DmConversation extends DmConversationSummary {
  /** Mais antigas primeiro. A API só devolve as 20 mais recentes. */
  messages: DmMessage[];
}

export interface DmAccount extends AccountCtx {
  handle: string;
}

export interface IgCommentReply {
  id: string;
  username: string;
  text: string;
  createdAt: Date;
  fromBusiness: boolean;
}

export interface IgComment extends IgCommentReply {
  hidden: boolean;
  replies: IgCommentReply[];
  /** A conta já respondeu a este comentário. */
  answered: boolean;
}

export interface IgCommentedPost {
  id: string;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  createdAt: Date;
  /** Mais recentes primeiro. */
  comments: IgComment[];
}

export interface MessagingClient {
  listConversations(account: DmAccount, deps: { fetch: typeof fetch }): Promise<DmConversationSummary[]>;
  getConversation(account: DmAccount, conversationId: string, deps: { fetch: typeof fetch }): Promise<DmConversation | null>;
  send(account: DmAccount, recipientId: string, text: string, deps: { fetch: typeof fetch }): Promise<void>;
  /** Comentários dos posts mais recentes (só posts com comentários). */
  listComments(account: DmAccount, deps: { fetch: typeof fetch }): Promise<IgCommentedPost[]>;
  /** Um comentário com a legenda do post (para a IA sugerir a resposta). */
  getComment(account: DmAccount, commentId: string, deps: { fetch: typeof fetch }): Promise<{ comment: IgComment; postCaption: string } | null>;
  replyToComment(account: DmAccount, commentId: string, text: string, deps: { fetch: typeof fetch }): Promise<void>;
  hideComment(account: DmAccount, commentId: string, hide: boolean, deps: { fetch: typeof fetch }): Promise<void>;
}

/** Limite de uma resposta a um comentário no Instagram. */
export const COMMENT_MAX_CHARS = 2200;

/** Limite de texto de uma mensagem na API do Instagram (bytes UTF-8). */
export const DM_MAX_BYTES = 1000;
