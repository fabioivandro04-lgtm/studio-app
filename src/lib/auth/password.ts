import { z } from 'zod';

export const PasswordChange = z
  .object({
    password: z.string().min(10, 'A palavra-passe precisa de pelo menos 10 caracteres.').max(72, 'A palavra-passe é demasiado longa.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'As duas palavras-passe não são iguais.', path: ['confirm'] });
