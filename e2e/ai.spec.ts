import { expect, test, type Page } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

// Corre com PLATFORM_MODE=fake: o fornecedor de IA falso devolve respostas fixas e custo 0.
let brand: { id: string; name: string };

async function connectInstagram(page: Page) {
  await page.goto('/definicoes/contas');
  await page.getByRole('region', { name: `Contas de ${brand.name}` }).getByRole('link', { name: 'Ligar Instagram' }).click();
  await expect(page.getByRole('status')).toContainText('ligada');
}

async function openComposerWithInstagram(page: Page) {
  await connectInstagram(page);
  await page.goto('/posts/novo');
  await page.getByLabel(/^Instagram @/).check();
}

async function generate(page: Page) {
  const panel = page.getByRole('region', { name: 'Assistente' });
  await panel.getByLabel('Sobre o que é este post?').fill('prazos Lisboa 2027, vagas para Angola');
  await panel.getByRole('button', { name: 'Gerar' }).click();
  await expect(panel.getByTestId('ai-caption').first()).toBeVisible();
  return panel;
}

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
  await admin().from('app_settings').update({ ai_monthly_limit_usd: 5 }).eq('id', true);
});

test('gera sugestões e usa legenda e hashtags', async ({ page }) => {
  await openComposerWithInstagram(page);
  const panel = await generate(page);
  const first = panel.getByTestId('ai-caption').first();
  const text = (await first.getByTestId('ai-caption-text').textContent())!;
  await first.getByRole('button', { name: 'Usar' }).click();
  const caption = page.getByLabel('Legenda Instagram');
  await expect(caption).toHaveValue(text);

  const tag = panel.getByRole('button', { name: '#estudarfora' }).first();
  await tag.click();
  await expect(tag).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Adicionar à legenda' }).first().click();
  await expect(caption).toHaveValue(/#estudarfora$/);
});

test('ação rápida com desfazer', async ({ page }) => {
  await openComposerWithInstagram(page);
  const caption = page.getByLabel('Legenda Instagram');
  await caption.fill('As candidaturas para Lisboa estão abertas.');
  await page.getByRole('button', { name: 'Reescrever com IA — Instagram' }).click();
  await page.getByRole('menuitem', { name: 'Encurtar' }).click();
  await expect(caption).toHaveValue(/^Versão melhorada:/);
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(caption).toHaveValue('As candidaturas para Lisboa estão abertas.');
});

test('erro mantém a legenda (limite mensal)', async ({ page }) => {
  await admin().from('app_settings').update({ ai_monthly_limit_usd: 0 }).eq('id', true);
  await openComposerWithInstagram(page);
  const caption = page.getByLabel('Legenda Instagram');
  await caption.fill('Texto original');
  await page.getByRole('button', { name: 'Reescrever com IA — Instagram' }).click();
  await page.getByRole('menuitem', { name: 'Mais chamativo' }).click();
  await expect(page.getByText(/limite mensal/)).toBeVisible();
  await expect(caption).toHaveValue('Texto original');
});

test('melhor hora preenche data e hora', async ({ page }) => {
  await page.goto('/posts/novo');
  await page.getByRole('button', { name: '🕐 Melhor hora' }).click();
  const slot = page.getByTestId('best-time-slot').first();
  await expect(slot).toBeVisible();
  await expect(page.getByText('sugestão inicial').first()).toBeVisible();
  const date = await slot.getAttribute('data-date');
  const time = await slot.getAttribute('data-time');
  await slot.click();
  await expect(page.getByLabel('Data')).toHaveValue(date!);
  await expect(page.getByLabel('Hora')).toHaveValue(time!);
});

test('contexto, voz e objetivo da marca', async ({ page }) => {
  await page.goto('/definicoes/marcas');
  const section = page.getByRole('group', { name: 'Assistente de IA' }).first();
  await section.locator('summary').click();
  await expect(section.getByRole('button', { name: '✨ Criar a partir do Instagram' })).toBeDisabled();
  await expect(section.getByText('Ligue o Instagram desta marca primeiro.')).toBeVisible();
});

test('guardar contexto e objetivo persiste', async ({ page }) => {
  await page.goto('/definicoes/marcas');
  const form = page.getByRole('form', { name: `Marca ${brand.name}` }).locator('xpath=..');
  const section = form.getByRole('group', { name: 'Assistente de IA' });
  await section.locator('summary').click();
  await section.getByLabel('Contexto da empresa').fill('Consultoria de candidaturas em Maputo.');
  await section.getByLabel('Objetivo').selectOption('reach');
  await section.getByRole('button', { name: 'Guardar IA' }).click();
  await expect(page.getByText('Definições de IA guardadas.')).toBeVisible();
  const { data } = await admin().from('brands').select('ai_context, goal').eq('id', brand.id).single();
  expect(data).toEqual({ ai_context: 'Consultoria de candidaturas em Maputo.', goal: 'reach' });
});
