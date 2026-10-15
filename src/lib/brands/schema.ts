import { z } from 'zod';

export const TIMEZONES = [
  { id: 'Africa/Maputo', label: 'Maputo (UTC+2)' },
  { id: 'Africa/Luanda', label: 'Luanda (UTC+1)' },
  { id: 'Atlantic/Cape_Verde', label: 'Praia (UTC−1)' },
  { id: 'Europe/Lisbon', label: 'Lisboa' },
  { id: 'Europe/Madrid', label: 'Madrid' },
  { id: 'Europe/Berlin', label: 'Berlim' },
  { id: 'Asia/Nicosia', label: 'Nicósia' },
  { id: 'Asia/Shanghai', label: 'Pequim (UTC+8)' },
  { id: 'America/Sao_Paulo', label: 'São Paulo (UTC−3)' },
  { id: 'UTC', label: 'UTC' },
] as const;

const TZ_IDS = TIMEZONES.map((t) => t.id) as [string, ...string[]];

export const BrandInput = z.object({
  name: z.string().trim().min(1, 'Dê um nome à marca.').max(80, 'O nome pode ter no máximo 80 caracteres.'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escolha uma cor válida.'),
  timezone: z.enum(TZ_IDS, { message: 'Escolha um fuso horário da lista.' }).default('Africa/Maputo'),
});
export type BrandInput = z.infer<typeof BrandInput>;

export const BrandAiInput = z.object({
  aiContext: z.string().max(4000, 'O contexto pode ter no máximo 4000 caracteres.'),
  aiVoice: z.string().max(2000, 'A voz da marca pode ter no máximo 2000 caracteres.'),
  aiHashtags: z
    .array(z.string().regex(/^#?[\p{L}\p{N}_]+$/u, 'Hashtag inválida: use só letras, números e _.'))
    .max(10, 'No máximo 10 hashtags fixas.'),
  goal: z.enum(['contacts', 'reach'], { message: 'Escolha o objetivo da marca.' }),
});
export type BrandAiInput = z.infer<typeof BrandAiInput>;

const MODEL_MSG = 'Escreva o id do modelo do OpenRouter (ex.: anthropic/claude-sonnet-5.5).';

export const AiSettingsInput = z.object({
  model: z.string().trim().min(3, MODEL_MSG).max(100, MODEL_MSG).regex(/^[\w.-]+\/[\w.:-]+$/, MODEL_MSG),
  limitUsd: z.number({ message: 'Escreva um limite em USD.' }).min(0, 'O limite não pode ser negativo.').max(1000, 'O limite máximo é 1000 USD.'),
});
export type AiSettingsInput = z.infer<typeof AiSettingsInput>;
