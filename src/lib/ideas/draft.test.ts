import { describe, expect, it } from 'vitest';
import { draftPayload, IdeaIdInput, IdeaStatusInput, GenerateInput } from './draft';

const idea = {
  title: 'Prazos Lisboa', caption: 'Legenda da ideia', format: 'ig_reel' as const, platforms: ['instagram' as const, 'youtube' as const],
};
const at = new Date('2026-10-20T17:00:00Z');
const id = '6f1c2a3b-1234-4abc-8def-0123456789ab';

describe('draftPayload', () => {
  it('rascunho sem mídia com as contas ativas das redes da ideia', () => {
    const p = draftPayload({ brandId: 'b1', idea, scheduledAt: at, accounts: [
      { id: 'ig1', platform: 'instagram', status: 'active' },
      { id: 'yt1', platform: 'youtube', status: 'active' },
      { id: 'tt1', platform: 'tiktok', status: 'active' },
    ] });
    expect(p).toEqual({
      brandId: 'b1', internalTitle: 'Prazos Lisboa', scheduledAt: '2026-10-20T17:00:00.000Z', intent: 'draft', mediaIds: [],
      targets: [
        { accountId: 'ig1', format: 'ig_reel', caption: 'Legenda da ideia', title: '' },
        { accountId: 'yt1', format: 'yt_short', caption: 'Legenda da ideia', title: 'Prazos Lisboa' },
      ],
    });
  });

  it('ignora contas que precisam de ser religadas; sem contas → sem destinos', () => {
    const p = draftPayload({ brandId: 'b1', idea, scheduledAt: at, accounts: [{ id: 'ig1', platform: 'instagram', status: 'needs_reauth' }] });
    expect(p.targets).toEqual([]);
  });

  it('título do YouTube cortado a 100 caracteres', () => {
    const p = draftPayload({ brandId: 'b1', idea: { ...idea, title: 'x'.repeat(120) }, scheduledAt: at, accounts: [{ id: 'yt1', platform: 'youtube', status: 'active' }] });
    expect(p.targets[0].title).toHaveLength(100);
    expect(p.internalTitle).toHaveLength(120);
  });

  it('uma conta por rede', () => {
    const p = draftPayload({ brandId: 'b1', idea: { ...idea, platforms: ['instagram'] }, scheduledAt: at, accounts: [
      { id: 'ig1', platform: 'instagram', status: 'active' },
      { id: 'ig2', platform: 'instagram', status: 'active' },
    ] });
    expect(p.targets.map((t) => t.accountId)).toEqual(['ig1']);
  });
});

describe('entradas', () => {
  it('validam ids e estados', () => {
    expect(IdeaIdInput.safeParse({ ideaId: 'x' }).success).toBe(false);
    expect(IdeaStatusInput.safeParse({ ideaId: id, status: 'used' }).success).toBe(false);
    expect(IdeaStatusInput.safeParse({ ideaId: id, status: 'discarded' }).success).toBe(true);
    expect(GenerateInput.safeParse({ brandId: '' }).error?.issues[0].message).toBe('Escolha uma marca primeiro.');
  });
});
