import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';

function keyFrom(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY tem de ter 32 bytes');
  return key;
}

export function encryptToken(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, keyFrom(keyB64), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `v1.${iv.toString('base64url')}.${data.toString('base64url')}`;
}

export function decryptToken(enc: string, keyB64: string): string {
  const parts = enc.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Token encriptado com formato desconhecido');
  const iv = Buffer.from(parts[1], 'base64url');
  const data = Buffer.from(parts[2], 'base64url');
  const decipher = createDecipheriv(ALG, keyFrom(keyB64), iv);
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString('utf8');
}
