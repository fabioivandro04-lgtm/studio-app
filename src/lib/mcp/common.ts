import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fromBrandRow, type Brand } from '@/lib/db/types';
import { localToUtc } from '@/lib/time/zone';
import { ToolError } from './result';

// Datas AAAA-MM-DD em UTC: com parseISO (hora local) o dia mudava fora de UTC.
const utcDay = (s: string) => new Date(`${s}T00:00:00Z`);

export const BrandId = z.guid('Id de marca inválido.');
export const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use datas no formato AAAA-MM-DD.')
  .refine((s) => !Number.isNaN(utcDay(s).getTime()) && utcDay(s).toISOString().startsWith(s), 'Data inválida.');
export const TimeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use horas no formato HH:MM.');

export function checkRange(de: string, ate: string, maxDays: number): void {
  const days = Math.round((utcDay(ate).getTime() - utcDay(de).getTime()) / 86_400_000);
  if (days < 0) throw new ToolError('A data final tem de ser igual ou depois da inicial.');
  if (days > maxDays) throw new ToolError(`Escolha no máximo ${maxDays} dias.`);
}

/** [início do dia `de`, início do dia seguinte a `ate`) no fuso dado. */
export function localDayRange(de: string, ate: string, tz: string): { from: Date; to: Date } {
  const next = new Date(utcDay(ate).getTime() + 86_400_000).toISOString().slice(0, 10);
  return { from: localToUtc(de, '00:00', tz), to: localToUtc(next, '00:00', tz) };
}

export async function loadBrand(db: SupabaseClient, brandId: string): Promise<Brand> {
  const { data, error } = await db.from('brands').select('*').eq('id', brandId).maybeSingle();
  if (error) throw new Error(`brand: ${error.message}`);
  if (!data) throw new ToolError('Marca não encontrada.');
  return fromBrandRow(data);
}

export async function loadBrands(db: SupabaseClient): Promise<Brand[]> {
  const { data, error } = await db.from('brands').select('*').order('created_at');
  if (error) throw new Error(`brands: ${error.message}`);
  return (data ?? []).map(fromBrandRow);
}

/** Contas (id → rede/@) de um conjunto de ids. */
export async function accountsById(db: SupabaseClient, ids: string[]): Promise<Map<string, { platform: string; handle: string }>> {
  if (!ids.length) return new Map();
  const { data, error } = await db.from('social_accounts').select('id, platform, handle').in('id', [...new Set(ids)]);
  if (error) throw new Error(`accounts: ${error.message}`);
  return new Map((data ?? []).map((a) => [a.id as string, { platform: a.platform as string, handle: a.handle as string }]));
}
