import { describe, expect, it } from 'vitest';
import { fakeAdapter } from './fake';
import type { AdvanceDeps, TargetCtx } from './types';

const deps = { now: () => new Date('2026-10-15T10:00:00Z') } as unknown as AdvanceDeps;
const acct = { id: 'a', externalId: 'x', accessToken: 't' };
const t = (format: TargetCtx['format'], progress = {}): TargetCtx => ({ id: 't', format, caption: '', title: null, options: {}, progress, media: [] });

describe('fakeAdapter', () => {
  it('Instagram: pending → processing → published', async () => {
    const a = fakeAdapter('instagram');
    const r1 = await a.advance(t('ig_image'), acct, deps);
    expect(r1).toMatchObject({ kind: 'progress', status: 'processing' });
    const r2 = await a.advance(t('ig_image', (r1 as { progress: Record<string, unknown> }).progress), acct, deps);
    expect(r2).toMatchObject({ kind: 'published', externalPostId: 'fake-instagram-t' });
  });

  it('TikTok e YouTube terminam em awaiting_user', async () => {
    for (const [p, f] of [['tiktok', 'tiktok_video'], ['youtube', 'yt_short']] as const) {
      const a = fakeAdapter(p);
      const r1 = await a.advance(t(f), acct, deps);
      expect((await a.advance(t(f, (r1 as { progress: Record<string, unknown> }).progress), acct, deps)).kind).toBe('awaiting_user');
    }
  });

  it('opção fail_permanent provoca falha definitiva', async () => {
    await expect(fakeAdapter('instagram').advance({ ...t('ig_image'), options: { fake: 'fail_permanent' } }, acct, deps)).rejects.toThrow();
  });

  it('authorizeUrl aponta para o callback com code=fake', () => {
    expect(fakeAdapter('tiktok').authorizeUrl('st', 'https://app/cb')).toBe('https://app/cb?code=fake&state=st');
  });

  it('exchangeCode devolve o perfil fake_<rede>', async () => {
    const r = await fakeAdapter('tiktok').exchangeCode('fake', 'x', { fetch, now: deps.now });
    expect(r.profile.handle).toBe('fake_tiktok');
  });

  it('valida com as regras reais', () => {
    expect(fakeAdapter('youtube').validate({ format: 'yt_short', caption: '', title: '' }, [])).not.toEqual([]);
  });
});
