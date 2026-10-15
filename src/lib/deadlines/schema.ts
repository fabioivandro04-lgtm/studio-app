import { z } from 'zod';

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const DeadlineInput = z.object({
  id: z.guid().optional(),
  brandId: z.guid(),
  title: z.string().trim().min(1, 'Escreva o nome do prazo.').max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data.'),
  country: optional(60),
  institution: optional(120),
  url: z.string().trim().optional().refine((v) => !v || /^https?:\/\//.test(v), 'O link tem de começar por http:// ou https://.').transform((v) => (v ? v : null)),
  notes: optional(1000),
});
export type DeadlineInputT = z.input<typeof DeadlineInput>;
