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
