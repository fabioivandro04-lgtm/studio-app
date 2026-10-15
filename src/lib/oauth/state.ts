import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Platform } from '@/lib/platforms/types';

const TTL_MS = 10 * 60_000;
const PLATFORMS = new Set<Platform>(['instagram', 'tiktok', 'youtube']);

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

/** Estado OAuth assinado: `<brandId>.<platform>.<emitidoEm>.<nonce>.<assinatura>`. */
export function createOAuthState(brandId: string, platform: Platform, secret: string, now = new Date()): string {
  const payload = [brandId, platform, now.getTime(), randomBytes(8).toString('base64url')].join('.');
  return `${payload}.${sign(payload, secret)}`;
}

export function readOAuthState(value: string, secret: string, now = new Date()): { brandId: string; platform: Platform } | null {
  const parts = value.split('.');
  if (parts.length !== 5) return null;
  const [brandId, platform, issued, , sig] = parts;
  const expected = Buffer.from(sign(parts.slice(0, 4).join('.'), secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!PLATFORMS.has(platform as Platform)) return null;
  const age = now.getTime() - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > TTL_MS) return null;
  return { brandId, platform: platform as Platform };
}
