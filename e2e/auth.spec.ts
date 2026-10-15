import { expect, test } from '@playwright/test';
import { loginAsOwner } from './helpers';

test('visitante é enviado para /login', async ({ page }) => {
  await page.goto('/calendario');
  await expect(page).toHaveURL(/\/login/);
});

test('login mostra o calendário com a navegação em português', async ({ page }) => {
  await loginAsOwner(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  for (const item of ['Calendário', 'Biblioteca', 'Pendentes', 'Métricas', 'Definições']) await expect(nav).toContainText(item);
});

test('/legal/privacidade é pública', async ({ page }) => {
  await page.goto('/legal/privacidade');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Política de Privacidade');
});

test('cron sem segredo → 401', async ({ request }) => {
  expect((await request.post('/api/cron/tick')).status()).toBe(401);
});
