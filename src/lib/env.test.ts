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

  it('OPENROUTER_API_KEY é opcional', () => {
    expect(parseServerEnv(minimalValidEnv).OPENROUTER_API_KEY).toBeUndefined();
    expect(parseServerEnv({ ...minimalValidEnv, OPENROUTER_API_KEY: 'sk-or-x' }).OPENROUTER_API_KEY).toBe('sk-or-x');
  });

  it('PLATFORM_MODE padrão é real', () => {
    const { PLATFORM_MODE: _omit, ...rest } = minimalValidEnv;
    expect(parseServerEnv(rest).PLATFORM_MODE).toBe('real');
  });

  it('rejeita TOKEN_ENC_KEY que não tem 32 bytes', () => {
    expect(() => parseServerEnv({ ...minimalValidEnv, TOKEN_ENC_KEY: 'abc' })).toThrow(/TOKEN_ENC_KEY/);
  });

  it('em modo real as credenciais das redes são opcionais (cada rede fica "por configurar")', () => {
    expect(parseServerEnv({ ...minimalValidEnv, PLATFORM_MODE: 'real' }).IG_APP_ID).toBeUndefined();
  });

  it('a chave de serviço do Supabase é opcional para a app arrancar', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _k, ...rest } = minimalValidEnv;
    expect(parseServerEnv(rest).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
