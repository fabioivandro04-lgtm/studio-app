import { describe, expect, it } from 'vitest';
import type { MediaInfo } from '@/lib/platforms/types';
import { planSchedule, type DraftCandidate } from './schedule';

const NOW = new Date('2026-10-20T10:00:00Z');
const B = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const M = '33333333-3333-4333-8333-333333333333';
const video: MediaInfo = { id: M, kind: 'video', mime: 'video/mp4', sizeBytes: 1000, width: 1080, height: 1920, durationS: 20, storagePath: 'x' };
const cand = (over: Partial<DraftCandidate> = {}, inp: Record<string, unknown> = {}): DraftCandidate => ({
  id: 'p1', status: 'draft', tz: 'Africa/Maputo', media: [video], accounts: [{ id: A, platform: 'instagram' }],
  input: { id: '44444444-4444-4444-8444-444444444444', brandId: B, internalTitle: 'T', mediaIds: [M], date: '2026-10-25', time: '19:00', targets: [{ accountId: A, format: 'ig_reel', caption: 'Olá', title: null }], intent: 'schedule', ...inp },
  ...over,
});

describe('planSchedule', () => {
  it('rascunho válido fica pronto com a hora UTC certa', () => {
    expect(planSchedule([cand()], NOW)).toEqual({ ready: [{ id: 'p1', scheduledAt: new Date('2026-10-25T17:00:00Z') }], skipped: [] });
  });
  it('data passada, não-rascunho, inexistente e aviso de validação ficam de fora com motivo', () => {
    const r = planSchedule([
      cand({ id: 'a' }, { date: '2026-10-01' }),
      cand({ id: 'b', status: 'scheduled' }),
      { id: 'c', missing: true },
      cand({ id: 'd', media: [{ ...video, durationS: 1 }] }),
    ], NOW);
    expect(r.ready).toEqual([]);
    expect(r.skipped).toEqual([
      { id: 'a', reason: 'A data já passou.' },
      { id: 'b', reason: 'Já não é um rascunho.' },
      { id: 'c', reason: 'Post não encontrado.' },
      { id: 'd', reason: 'O Reel tem de ter pelo menos 3 s.' },
    ]);
  });
});

describe('draftWarnings', () => {
  it('sem data → pede dia e hora; avisos por rede com o nome da rede', async () => {
    const { draftWarnings } = await import('./drafts-repo');
    const c = cand() as Extract<DraftCandidate, { status: string }>;
    expect(draftWarnings({ ...c, input: { ...c.input, date: '', time: '' } }, NOW)).toEqual(['Falta escolher o dia e a hora.']);
    expect(draftWarnings({ ...c, media: [{ ...video, durationS: 1 }] }, NOW)).toEqual(['Instagram: O Reel tem de ter pelo menos 3 s.']);
    expect(draftWarnings(c, NOW)).toEqual([]);
  });
});
