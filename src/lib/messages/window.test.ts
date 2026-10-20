import { describe, expect, it } from 'vitest';
import type { DmMessage } from './types';
import { replyWindow } from './window';

const NOW = new Date('2026-10-20T12:00:00Z');
const msg = (iso: string, fromBusiness: boolean): DmMessage => ({
  id: iso, createdAt: new Date(iso), fromBusiness, text: 'x', attachments: [], story: null, unsupported: false,
});

describe('replyWindow', () => {
  it('fica aberta até 24 h depois da última mensagem do cliente', () => {
    const w = replyWindow([msg('2026-10-19T15:00:00Z', false), msg('2026-10-20T09:00:00Z', true)], NOW);
    expect(w).toEqual({ open: true, closesAt: new Date('2026-10-20T15:00:00Z') });
  });

  it('as respostas da conta não reabrem a janela', () => {
    const w = replyWindow([msg('2026-10-19T10:00:00Z', false), msg('2026-10-20T11:00:00Z', true)], NOW);
    expect(w).toEqual({ open: false, closesAt: new Date('2026-10-20T10:00:00Z') });
  });

  it('fechada se o cliente nunca escreveu', () => {
    expect(replyWindow([msg('2026-10-20T11:00:00Z', true)], NOW)).toEqual({ open: false, closesAt: null });
  });
});
