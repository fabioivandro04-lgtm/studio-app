import type { SupabaseClient } from '@supabase/supabase-js';
import type { McpCtx } from '../context';

export const TEST_NOW = new Date('2026-10-20T10:00:00Z');

export function testCtx(db: SupabaseClient, over: Partial<McpCtx> = {}): McpCtx {
  return {
    db, svc: () => db, userId: 'owner', clientId: 'claude-test', rateKey: 't', take: () => true,
    now: () => TEST_NOW, appUrl: 'https://app.test', maxUploadMb: 50, ...over,
  };
}
