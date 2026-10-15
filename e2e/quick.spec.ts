import { expect, test, type Page } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

// Corre com PLATFORM_MODE=fake (contas e publicação falsas).
let brand: { id: string; name: string };
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

async function connectInstagram(page: Page) {
  await page.goto('/definicoes/contas');
  await page.getByRole('region', { name: `Contas de ${brand.name}` }).getByRole('link', { name: 'Ligar Instagram' }).click();
  await expect(page.getByRole('status')).toContainText('ligada');
}

/** Cria um rascunho pelo editor e devolve o id. */
async function draft(page: Page, title: string, date = '2027-03-10') {
  await page.goto('/posts/novo');
  await page.getByLabel('Título interno (só para si)').fill(title);
  await page.getByLabel(/^Instagram @/).check();
  await page.getByLabel('Legenda Instagram').fill('Legenda base');
  await page.getByLabel('Data').fill(date);
  await page.getByRole('button', { name: 'Guardar rascunho' }).click();
  await page.waitForURL('**/calendario');
  const { data } = await admin().from('posts').select('id').eq('brand_id', brand.id).eq('internal_title', title).single();
  return data!.id as string;
}

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: baseUrl }]);
  await loginAsOwner(page);
  await connectInstagram(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

test('duplicar abre a cópia', async ({ page }) => {
  const id = await draft(page, 'Original');
  await page.goto(`/posts/${id}`);
  await page.getByRole('button', { name: 'Duplicar' }).click();
  await page.waitForURL((u) => /\/posts\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(id));
  await expect(page.getByLabel('Título interno (só para si)')).toHaveValue('Original (cópia)');
});

test('grupo de hashtags criado em Definições e usado no post, com Desfazer', async ({ page }) => {
  await page.goto('/definicoes/marcas');
  const section = page.getByRole('group', { name: 'Grupos de hashtags' }).filter({ has: page.getByRole('button', { name: '+ Novo grupo' }) }).last();
  await section.getByRole('button', { name: '+ Novo grupo' }).click();
  await section.getByLabel('Nome do grupo').fill('Bolsas');
  await section.getByLabel('Hashtags').fill('bolsas, #estudar #bolsas');
  await section.getByRole('button', { name: 'Guardar grupo' }).click();
  await expect(section.getByText('#bolsas #estudar')).toBeVisible();

  await page.goto('/posts/novo');
  await page.getByLabel(/^Instagram @/).check();
  const caption = page.getByLabel('Legenda Instagram');
  await caption.fill('Olá');
  await page.getByRole('button', { name: 'Hashtags' }).click();
  await page.getByRole('menuitem', { name: /Bolsas/ }).click();
  await expect(caption).toHaveValue('Olá\n\n#bolsas #estudar');
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(caption).toHaveValue('Olá');
});

test('horários fixos e "Próximo horário livre"', async ({ page }) => {
  await admin().from('brands').update({ posting_slots: [{ weekday: 3, time: '18:30' }] }).eq('id', brand.id);
  await page.goto('/posts/novo');
  await page.getByRole('button', { name: /Próximo horário livre/ }).click();
  await expect(page.getByLabel('Hora')).toHaveValue('18:30');
  const date = await page.getByLabel('Data').inputValue();
  expect(new Date(`${date}T12:00:00Z`).getUTCDay()).toBe(3);
});

test.describe('telemóvel', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('Mover muda o dia e mantém a hora', async ({ page }) => {
    const id = await draft(page, 'Para mover', '2027-03-10');
    await page.goto('/calendario?data=2027-03-10');
    await page.getByRole('button', { name: 'Dia 2027-03-10' }).click();
    await page.getByRole('button', { name: 'Mover Para mover' }).click();
    await page.getByLabel('Novo dia').fill('2027-03-12');
    await page.getByRole('button', { name: 'Mover para este dia' }).click();
    await expect(page.getByText(/Post movido para/)).toBeVisible();
    const { data } = await admin().from('posts').select('scheduled_at').eq('id', id).single();
    expect(new Date(data!.scheduled_at).toISOString().slice(0, 10)).toBe('2027-03-12');
  });
});
