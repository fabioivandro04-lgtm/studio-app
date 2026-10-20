import type { DmConversation, DmMessage, IgComment, IgCommentedPost, MessagingClient } from './types';

/** Mensagens falsas para desenvolvimento e e2e (PLATFORM_MODE=fake). Ficam em memória no servidor. */
const store = new Map<string, DmConversation[]>();

function seed(now: Date): DmConversation[] {
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000);
  const msg = (id: string, minAgo: number, fromBusiness: boolean, text: string, story: DmMessage['story'] = null): DmMessage => ({
    id, createdAt: at(minAgo), fromBusiness, text, attachments: [], story, unsupported: false,
  });
  const conv = (id: string, username: string, messages: DmMessage[]): DmConversation => ({
    id, customer: { id: `igsid-${username}`, username }, messages, last: messages.at(-1) ?? null, updatedAt: messages.at(-1)!.createdAt,
  });
  return [
    conv('fake-conv-1', 'cliente_ana', [
      msg('m1', 90, false, 'Olá! Ainda há vagas para o curso de outubro?'),
      msg('m2', 80, true, 'Olá Ana! Há sim, quer que lhe envie o formulário?'),
      msg('m3', 30, false, 'Sim, por favor 🙏'),
    ]),
    conv('fake-conv-2', 'joao.m', [msg('m4', 60 * 30, false, 'Adorei esta story!', 'reply')]),
  ];
}

const commentStore = new Map<string, IgCommentedPost[]>();

function seedComments(now: Date): IgCommentedPost[] {
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000);
  const comment = (id: string, username: string, minAgo: number, text: string): IgComment => ({
    id, username, text, createdAt: at(minAgo), fromBusiness: false, hidden: false, replies: [], answered: false,
  });
  return [{
    id: 'fake-media-1', caption: 'As candidaturas para outubro estão abertas!', permalink: 'https://example.com/p/1', thumbnailUrl: null, createdAt: at(60 * 24),
    comments: [comment('fc1', 'maria.s', 45, 'Qual é o preço? 🙏'), comment('fc2', 'pedro_23', 300, 'Ainda dá para me inscrever?')],
  }];
}

function comments(accountId: string): IgCommentedPost[] {
  if (!commentStore.has(accountId)) commentStore.set(accountId, seedComments(new Date()));
  return commentStore.get(accountId)!;
}

const findComment = (accountId: string, id: string) => {
  for (const p of comments(accountId)) {
    const c = p.comments.find((x) => x.id === id);
    if (c) return { post: p, comment: c };
  }
  return null;
};

function conversations(accountId: string): DmConversation[] {
  if (!store.has(accountId)) store.set(accountId, seed(new Date()));
  return store.get(accountId)!;
}

export function fakeMessaging(): MessagingClient {
  return {
    async listConversations(account) {
      return conversations(account.id).map(({ messages: _m, ...c }) => c);
    },
    async getConversation(account, id) {
      return conversations(account.id).find((c) => c.id === id) ?? null;
    },
    async send(account, recipientId, text) {
      const c = conversations(account.id).find((x) => x.customer.id === recipientId);
      if (!c) throw new Error('fake: conversa desconhecida');
      const m: DmMessage = { id: `fake-${Date.now()}`, createdAt: new Date(), fromBusiness: true, text, attachments: [], story: null, unsupported: false };
      c.messages.push(m);
      c.last = m;
      c.updatedAt = m.createdAt;
    },
    async listComments(account) {
      return comments(account.id);
    },
    async getComment(account, id) {
      const f = findComment(account.id, id);
      return f ? { comment: f.comment, postCaption: f.post.caption } : null;
    },
    async replyToComment(account, id, text) {
      const f = findComment(account.id, id);
      if (!f) throw new Error('fake: comentário desconhecido');
      f.comment.replies.push({ id: `fake-r-${Date.now()}`, username: account.handle, text, createdAt: new Date(), fromBusiness: true });
      f.comment.answered = true;
    },
    async hideComment(account, id, hide) {
      const f = findComment(account.id, id);
      if (f) f.comment.hidden = hide;
    },
  };
}
