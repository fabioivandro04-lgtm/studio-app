import type { APIRequestContext, Page } from '@playwright/test';

export async function loginAsOwner(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error('Defina E2E_EMAIL e E2E_PASSWORD');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).last().fill(email);
  await page.getByLabel('Palavra-passe').fill(password);
  await page.getByRole('button', { name: 'Entrar com palavra-passe' }).click();
  await page.waitForURL('**/calendario');
}

export async function runTick(request: APIRequestContext) {
  const res = await request.post('/api/cron/tick', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  if (!res.ok()) throw new Error(`tick falhou: ${res.status()}`);
  return res.json();
}
