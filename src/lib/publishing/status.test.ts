import { describe, expect, it } from 'vitest';
import { derivePostStatus } from './status';

describe('derivePostStatus', () => {
  it('segue a mesma regra que refresh_post_status', () => {
    expect(derivePostStatus('scheduled', ['pending', 'pending'])).toBe('scheduled');
    expect(derivePostStatus('scheduled', ['published', 'pending'])).toBe('publishing');
    expect(derivePostStatus('scheduled', ['uploading', 'pending'])).toBe('publishing');
    expect(derivePostStatus('publishing', ['published', 'awaiting_user'])).toBe('needs_action');
    expect(derivePostStatus('publishing', ['published', 'failed'])).toBe('partial');
    expect(derivePostStatus('publishing', ['awaiting_user', 'failed'])).toBe('partial');
    expect(derivePostStatus('publishing', ['failed', 'failed'])).toBe('failed');
    expect(derivePostStatus('publishing', ['published', 'published'])).toBe('published');
  });

  it('draft e cancelled não mudam', () => {
    expect(derivePostStatus('cancelled', ['pending'])).toBe('cancelled');
    expect(derivePostStatus('draft', ['published'])).toBe('draft');
  });

  it('sem destinos mantém o estado', () => {
    expect(derivePostStatus('scheduled', [])).toBe('scheduled');
  });
});
