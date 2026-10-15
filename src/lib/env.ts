import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const base = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
  TOKEN_ENC_KEY: z
    .string()
    .min(1)
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'tem de ter 32 bytes em base64'),
  PLATFORM_MODE: z.enum(['real', 'fake']).default('real'),
  IG_APP_ID: z.string().optional(),
  IG_APP_SECRET: z.string().optional(),
  IG_API_VERSION: z.string().default('v23.0'),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  YT_UPLOAD_UNITS: z.coerce.number().int().positive().default(1600),
  YT_DAILY_UNITS: z.coerce.number().int().positive().default(10000),
  NEXT_PUBLIC_MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
  NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: bool,
});

export type ServerEnv = z.infer<typeof base>;

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ''));
  const result = base.safeParse(cleaned);
  const problems: string[] = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  if (problems.length > 0 || !result.success) {
    throw new Error(`Configuração inválida:\n${problems.join('\n')}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export const clientEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  maxUploadMb: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50),
  enablePasswordLogin: process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN === 'true',
};
