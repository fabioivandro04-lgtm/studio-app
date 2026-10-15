import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseStorage } from './storage';

const client = {
  storage: { from: () => ({ createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://s/${p}` }, error: null }) }) },
} as unknown as SupabaseClient;

describe('createSupabaseStorage.readRange', () => {
  it('envia o cabeçalho Range e devolve os bytes (206)', async () => {
    let range = '';
    const f = (async (_u: string, init: RequestInit) => {
      range = (init.headers as Record<string, string>).Range;
      return new Response(new Uint8Array([3, 4]), { status: 206 });
    }) as unknown as typeof fetch;
    const out = await createSupabaseStorage(client, 'media', f).readRange('a.mp4', 3, 4);
    expect(range).toBe('bytes=3-4');
    expect([...out]).toEqual([3, 4]);
  });

  it('recorta quando o servidor ignora o Range (200)', async () => {
    const f = (async () => new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { status: 200 })) as unknown as typeof fetch;
    const out = await createSupabaseStorage(client, 'media', f).readRange('a.mp4', 2, 3);
    expect([...out]).toEqual([2, 3]);
  });
});
