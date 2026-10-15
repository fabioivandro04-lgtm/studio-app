import { describe, expect, it } from 'vitest';
import { parseServerEnv } from './env';

const key = Buffer.alloc(32, 7).toString('base64');

const minimalValidEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  APP_URL: 'https://estudio.example.com',
  CRON_SECRET: 'segredo',
  TOKEN_ENC_KEY: key,
  PLATFORM_MODE: 'fake',
};

describe('parseServerEnv', () => {
  it('lista as variáveis em falta', () => {
    expect(() => parseServerEnv({})).toThrow(/CRON_SECRET[\s\S]*TOKEN_ENC_KEY/);
  });

  it('aplica padrões', () => {
    const env = parseServerEnv(minimalValidEnv);
    expect(env.NEXT_PUBLIC_MAX_UPLOAD_MB).toBe(50);
    expect(env.YT_UPLOAD_UNITS).toBe(1600);
    expect(env.YT_DAILY_UNITS).toBe(10000);
    expect(env.IG_API_VERSION).toBe('v23.0');
    expect(env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN).toBe(false);
  });

  it('PLATFORM_MODE padrão é real', () => {
    const { PLATFORM_MODE: _omit, ...rest } = minimalValidEnv;
    expect(() => parseServerEnv(rest)).toThrow(/IG_APP_ID/);
  });

  it('rejeita TOKEN_ENC_KEY que não tem 32 bytes', () => {
    expect(() => parseServerEnv({ ...minimalValidEnv, TOKEN_ENC_KEY: 'abc' })).toThrow(/TOKEN_ENC_KEY/);
  });

  it('em modo real exige as credenciais das redes', () => {
    expect(() => parseServerEnv({ ...minimalValidEnv, PLATFORM_MODE: 'real' })).toThrow(
      /IG_APP_ID[\s\S]*TIKTOK_CLIENT_KEY[\s\S]*GOOGLE_CLIENT_ID/,
    );
  });
});
