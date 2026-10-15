import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { fromBrandRow, type Brand } from '@/lib/db/types';

import { ALL_BRANDS, BRAND_COOKIE } from './brand-cookie';

export { ALL_BRANDS, BRAND_COOKIE };

/** Marcas por ordem de criação. Em cache por pedido: o layout e a página fazem uma só consulta. */
export const listBrands = cache(async (db: SupabaseClient): Promise<Brand[]> => {
  const { data, error } = await db.from('brands').select('*').order('created_at');
  if (error) throw new Error(`brands: ${error.message}`);
  return (data ?? []).map(fromBrandRow);
});

/** Marca escolhida no seletor (cookie), ou null para "Todas as marcas". */
export async function selectedBrandId(brands: Brand[]): Promise<string | null> {
  const v = (await cookies()).get(BRAND_COOKIE)?.value;
  if (!v || v === ALL_BRANDS) return null;
  return brands.some((b) => b.id === v) ? v : null;
}
