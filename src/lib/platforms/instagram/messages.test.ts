import { describe, expect, it } from 'vitest';
import { PermanentError } from '../errors';
import { fakeFetch, jsonResponse } from '../testing/fake-fetch';
import { instagramMessaging, MessagesPermissionError } from './messages';

const messaging = instagramMessaging({ appId: 'app', appSecret: 'sec', apiVersion: 'v23.0' });
const account = { id: 'acc-1', externalId: '1784', handle: 'unidreamity', accessToken: 'tok' };
const participants = { data: [{ id: '1784', username: 'unidreamity' }, { id: 'igsid-9', username: 'cliente_ana' }] };

describe('Instagram: mensagens diretas', () => {
  it('lista as conversas com o cliente e a última mensagem', async () => {
    const fetch = fakeFetch([
      ['GET', /\/v23\.0\/me\/conversations\?/, (c) => {
        expect(c.params).toMatchObject({ platform: 'instagram', access_token: 'tok' });
        expect(String(c.params.fields)).toContain('messages.limit(1)');
        return {
          data: [{
            id: 'conv-1', updated_time: '2026-10-20T10:00:00+0000', participants,
            messages: { data: [{ id: 'm2', created_time: '2026-10-20T10:00:00+0000', from: { id: 'igsid-9', username: 'cliente_ana' }, message: 'Olá!' }] },
          }],
        };
      }],
    ]);
    const list = await messaging.listConversations(account, { fetch });
    expect(list).toEqual([{
      id: 'conv-1',
      updatedAt: new Date('2026-10-20T10:00:00Z'),
      customer: { id: 'igsid-9', username: 'cliente_ana' },
      last: { id: 'm2', createdAt: new Date('2026-10-20T10:00:00Z'), fromBusiness: false, text: 'Olá!', attachments: [], story: null, unsupported: false },
    }]);
  });

  it('abre uma conversa por ordem cronológica, com anexos e respostas a stories', async () => {
    const fetch = fakeFetch([
      ['GET', /\/v23\.0\/conv-1\?/, () => ({
        id: 'conv-1', updated_time: '2026-10-20T10:05:00+0000', participants,
        messages: { data: [
          { id: 'm3', created_time: '2026-10-20T10:05:00+0000', from: { id: '1784', username: 'unidreamity' }, message: 'Obrigado!' },
          { id: 'm2', created_time: '2026-10-20T10:01:00+0000', from: { id: 'igsid-9' }, attachments: { data: [{ image_data: { url: 'https://cdn/img.jpg' } }] } },
          { id: 'm1', created_time: '2026-10-20T10:00:00+0000', from: { id: 'igsid-9' }, message: 'Que giro', story: { reply_to: { id: 's1', link: 'https://cdn/s1' } } },
        ] },
      })],
    ]);
    const c = await messaging.getConversation(account, 'conv-1', { fetch });
    expect(c?.messages.map((m) => [m.id, m.fromBusiness, m.story])).toEqual([['m1', false, 'reply'], ['m2', false, null], ['m3', true, null]]);
    expect(c?.messages[1].attachments).toEqual([{ kind: 'image', url: 'https://cdn/img.jpg' }]);
    expect(c?.last?.id).toBe('m3');
  });

  it('envia texto ao cliente pelo IGSID', async () => {
    const fetch = fakeFetch([['POST', /\/v23\.0\/1784\/messages$/, () => ({ recipient_id: 'igsid-9', message_id: 'mid' })]]);
    await messaging.send(account, 'igsid-9', 'Olá Ana', { fetch });
    expect(fetch.calls[0].params).toMatchObject({ recipient: '{"id":"igsid-9"}', message: '{"text":"Olá Ana"}', access_token: 'tok' });
  });

  it('sem a permissão de mensagens pede para religar a conta', async () => {
    const fetch = fakeFetch([['GET', /conversations/, () => jsonResponse(403, { error: { code: 10, message: '(#10) Application does not have permission for this action' } })]]);
    const err = await messaging.listConversations(account, { fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(MessagesPermissionError);
    expect(err.userMessage).toContain('volte a ligar a conta');
  });

  it('fora da janela de 24 h explica que tem de responder no telemóvel', async () => {
    const fetch = fakeFetch([['POST', /messages$/, () => jsonResponse(400, { error: { code: 10, error_subcode: 2534022, message: '(#10) This message is sent outside of allowed window.' } })]]);
    const err = await messaging.send(account, 'igsid-9', 'Olá', { fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(PermanentError);
    expect(err.userMessage).toContain('24 h');
  });

  it('lista comentários dos posts recentes, sem os da própria conta, e marca os respondidos', async () => {
    const fetch = fakeFetch([
      ['GET', /\/1784\/media\?/, () => ({ data: [
        { id: 'p1', caption: 'Inscrições abertas', permalink: 'https://ig/p1', timestamp: '2026-10-19T10:00:00+0000', media_type: 'IMAGE', media_url: 'https://cdn/p1.jpg', comments_count: 3 },
        { id: 'p2', caption: 'Sem comentários', timestamp: '2026-10-18T10:00:00+0000', comments_count: 0 },
      ] })],
      ['GET', /\/p1\/comments\?/, () => ({ data: [
        { id: 'c1', text: 'Qual o preço?', username: 'ana', timestamp: '2026-10-19T11:00:00+0000', from: { id: '9', username: 'ana' },
          replies: { data: [{ id: 'r1', text: '@ana 50 €', username: 'unidreamity', timestamp: '2026-10-19T12:00:00+0000', from: { id: '1784', username: 'unidreamity' } }] } },
        { id: 'c2', text: 'Obrigado a todos!', username: 'unidreamity', timestamp: '2026-10-19T13:00:00+0000', from: { id: '1784' } },
        { id: 'c3', text: 'Ainda há vagas?', username: 'rui', timestamp: '2026-10-19T14:00:00+0000', hidden: true },
      ] })],
    ]);
    const posts = await messaging.listComments(account, { fetch });
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: 'p1', thumbnailUrl: 'https://cdn/p1.jpg' });
    expect(posts[0].comments.map((c) => [c.id, c.answered, c.hidden])).toEqual([['c3', false, true], ['c1', true, false]]);
  });

  it('responde e esconde comentários', async () => {
    const fetch = fakeFetch([
      ['POST', /\/c1\/replies$/, () => ({ id: 'r2' })],
      ['POST', /\/c1$/, () => ({ success: true })],
    ]);
    await messaging.replyToComment(account, 'c1', '@ana Obrigado!', { fetch });
    await messaging.hideComment(account, 'c1', true, { fetch });
    expect(fetch.calls.map((c) => c.params)).toMatchObject([{ message: '@ana Obrigado!' }, { hide: 'true' }]);
  });
});
