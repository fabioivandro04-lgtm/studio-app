import type { APIRequestContext, Page } from '@playwright/test';

export async function loginAsOwner(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error('Defina E2E_EMAIL e E2E_PASSWORD');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).first().fill(email);
  await page.getByLabel('Palavra-passe').fill(password);
  await page.getByRole('button', { name: 'Entrar com palavra-passe' }).click();
  await page.waitForURL('**/calendario');
}

export async function runTick(request: APIRequestContext) {
  const res = await request.post('/api/cron/tick', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  if (!res.ok()) throw new Error(`tick falhou: ${res.status()}`);
  return res.json();
}

import { createClient } from '@supabase/supabase-js';

/** Cliente de serviço para preparar e limpar dados nos testes e2e. */
export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** Cria uma marca de teste única e devolve o id; apagar no fim com cleanupBrand. */
export async function createTestBrand(name = `E2E ${Date.now()}`) {
  const { data, error } = await admin().from('brands').insert({ name, color: '#F0A93B' }).select('id, name').single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function cleanupBrand(id: string) {
  const db = admin();
  const { data: posts } = await db.from('posts').select('id').eq('brand_id', id);
  if (posts?.length) await db.from('posts').delete().in('id', posts.map((p) => p.id));
  await db.from('brands').delete().eq('id', id);
}
