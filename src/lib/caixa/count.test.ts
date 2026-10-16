import { describe, expect, it } from 'vitest';
import { inboxCount } from './count';

describe('inboxCount', () => {
  it('soma toques, falhas e rascunhos do Claude; nunca negativo', () => {
    expect(inboxCount({ awaiting: 1, failed: 2, claudeDrafts: 3 })).toBe(6);
    expect(inboxCount({ awaiting: 0, failed: 0, claudeDrafts: 0 })).toBe(0);
    expect(inboxCount({ awaiting: -1, failed: 0, claudeDrafts: 0 })).toBe(0);
  });
});
