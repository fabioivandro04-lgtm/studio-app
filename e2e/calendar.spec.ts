import { expect, test } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

let brand: { id: string; name: string };
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

async function seedPost(dateIso: string, title = 'Post E2E') {
  const { data } = await admin().from('posts').insert({ brand_id: brand.id, internal_title: title, status: 'scheduled', scheduled_at: `${dateIso}T07:00:00Z` }).select('id').single();
  return data!.id as string;
}

test('post agendado aparece no dia certo (09:00 Maputo)', async ({ page }) => {
  const d = day(3);
  await seedPost(d);
  await page.goto(`/calendario?vista=semana&data=${d}`);
  await expect(page.locator(`[data-day="${d}"]`).getByTestId('post-card')).toContainText('09:00 Post E2E');
});

test('prazo aparece como chip âmbar', async ({ page }) => {
  const d = day(5);
  await admin().from('deadlines').insert({ brand_id: brand.id, title: 'Candidaturas Lisboa', due_date: d });
  await page.goto(`/calendario?vista=semana&data=${d}`);
  await expect(page.locator(`[data-day="${d}"]`).getByTestId('deadline-chip')).toContainText('Candidaturas Lisboa');
});

test('arrastar para outro dia mantém a hora', async ({ page }) => {
  const d = day(2);
  const id = await seedPost(d);
  await page.goto(`/calendario?vista=semana&data=${d}`);
  const target = (await page.locator('[data-day]').evaluateAll((els, src) => els.map((e) => e.getAttribute('data-day')).find((x) => x !== src), d))!;
  await page.locator(`[data-day="${d}"]`).getByTestId('post-card').dragTo(page.locator(`[data-day="${target}"]`));
  await expect(page.getByText('Post reagendado.')).toBeVisible();
  const { data } = await admin().from('posts').select('scheduled_at').eq('id', id).single();
  expect(new Date(data!.scheduled_at).toISOString()).toBe(`${target}T07:00:00.000Z`);
});

test('filtro de marca esconde posts de outras marcas', async ({ page, context }) => {
  const other = await createTestBrand('E2E outra');
  try {
    const d = day(4);
    await admin().from('posts').insert({ brand_id: other.id, internal_title: 'De outra marca', status: 'scheduled', scheduled_at: `${d}T07:00:00Z` });
    await page.goto(`/calendario?vista=semana&data=${d}`);
    await expect(page.getByText('De outra marca')).toHaveCount(0);
    await context.addCookies([{ name: 'brand', value: 'todas', url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
    await page.reload();
    await expect(page.getByTestId('calendar-grid').getByText('De outra marca')).toBeVisible();
  } finally {
    await cleanupBrand(other.id);
  }
});
