import type { DmConversation, DmMessage, MessagingClient } from './types';

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
  };
}
