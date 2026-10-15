import { describe, expect, it } from 'vitest';
import { canDeletePost } from './delete-rules';

describe('canDeletePost', () => {
  it('pode apagar rascunhos, publicados, parciais, falhados e cancelados', () => {
    for (const s of ['draft', 'published', 'partial', 'failed', 'cancelled'] as const) expect(canDeletePost(s, ['published'])).toBe(true);
  });
  it('não pode apagar agendados nem posts a meio da publicação', () => {
    for (const s of ['scheduled', 'publishing', 'needs_action'] as const) expect(canDeletePost(s, [])).toBe(false);
    expect(canDeletePost('partial', ['published', 'processing'])).toBe(false);
    expect(canDeletePost('failed', ['awaiting_user'])).toBe(false);
  });
});
