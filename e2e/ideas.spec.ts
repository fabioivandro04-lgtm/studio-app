import { expect, test } from '@playwright/test';
import { cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

// Corre com PLATFORM_MODE=fake: o fornecedor de IA falso devolve "Quantidade: N" ideias, custo 0.
let brand: { id: string; name: string };
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('com marca escolhida', () => {
  test.beforeEach(async ({ page, context }) => {
    brand = await createTestBrand();
    await context.addCookies([{ name: 'brand', value: brand.id, url: baseUrl }]);
    await loginAsOwner(page);
  });
  test.afterEach(async () => {
    await cleanupBrand(brand.id);
  });

  test('vídeos curtos: 10 ideias, descartar e recuperar', async ({ page }) => {
    await page.goto('/ideias');
    await page.getByRole('button', { name: /Vídeos curtos/ }).click();
    await expect(page.getByTestId('idea-card')).toHaveCount(10);

    await page.getByTestId('idea-card').first().getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByTestId('idea-card')).toHaveCount(9);
    await page.getByRole('link', { name: /Descartadas \(1\)/ }).click();
    await page.getByTestId('idea-card').getByRole('button', { name: 'Recuperar' }).click();
    await expect(page.getByTestId('idea-card')).toHaveCount(0);
    await page.getByRole('link', { name: /Novas \(10\)/ }).click();
    await expect(page.getByTestId('idea-card')).toHaveCount(10);
  });

  test('planear a semana e pôr uma ideia no calendário', async ({ page }) => {
    await page.goto('/ideias');
    await page.getByRole('button', { name: /Planear a próxima semana/ }).click();
    await expect(page.getByTestId('idea-card')).toHaveCount(3); // 3 posts por semana (omissão)

    const card = page.getByTestId('idea-card').first();
    const title = (await card.locator('p.font-medium').textContent())!;
    await card.getByRole('button', { name: 'Pôr no calendário' }).click();
    await page.waitForURL(/\/posts\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel('Título interno (só para si)')).toHaveValue(title);

    await page.goto('/ideias?estado=usadas');
    await expect(page.getByTestId('idea-card')).toHaveCount(1);
    await expect(page.getByTestId('idea-card').getByRole('link', { name: 'Abrir post' })).toBeVisible();
  });
});

test('"Todas as marcas" pede uma marca', async ({ page, context }) => {
  await context.addCookies([{ name: 'brand', value: 'all', url: baseUrl }]);
  await loginAsOwner(page);
  await page.goto('/ideias');
  await expect(page.getByText('Escolha uma marca no topo para gerar ideias.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Vídeos curtos/ })).toHaveCount(0);
});
