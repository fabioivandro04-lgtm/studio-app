import { timingSafeEqual } from 'node:crypto';

/** Verifica `Authorization: Bearer <secret>` em tempo constante. */
export function verifyCronAuth(req: Request, secret: string): boolean {
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
