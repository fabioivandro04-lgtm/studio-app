import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '@/lib/env';
import { PermanentError } from './errors';
import { getAdapters } from './registry';

const env = parseServerEnv({
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', APP_URL: 'https://app.test',
  CRON_SECRET: 's', TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PLATFORM_MODE: 'real',
  TIKTOK_CLIENT_KEY: 'ck', TIKTOK_CLIENT_SECRET: 'cs',
});

describe('getAdapters em modo real', () => {
  it('rede sem credenciais dá erro claro ao ligar e ao publicar', async () => {
    const ig = getAdapters(env).instagram;
    expect(() => ig.authorizeUrl('st', 'https://app.test/cb')).toThrow(/Instagram ainda não está configurado/);
    await expect(ig.advance({} as never, {} as never, {} as never)).rejects.toBeInstanceOf(PermanentError);
  });
  it('rede com credenciais usa o adaptador real', () => {
    expect(getAdapters(env).tiktok.authorizeUrl('st', 'https://app.test/cb')).toMatch(/^https:\/\/www\.tiktok\.com\//);
  });
  it('validação continua disponível sem credenciais', () => {
    expect(getAdapters(env).youtube.validate({ format: 'yt_short', caption: '', title: '' }, [])).not.toEqual([]);
  });
});
