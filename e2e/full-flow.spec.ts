import path from 'node:path';
import { expect, test } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner, runTick } from './helpers';

let brand: { id: string; name: string };

test('/manifest.webmanifest tem lang pt-PT e display standalone', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m).toMatchObject({ lang: 'pt-PT', display: 'standalone' });
});

test.describe('fluxo completo', () => {
test.beforeEach(async ({ context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

test('marca → mídia → 3 redes → tick → IG publicado, TikTok/YouTube aguardam → marcar feito → métricas', async ({ page, request }) => {
  await loginAsOwner(page);
  await page.goto('/definicoes/contas');
  const section = page.getByRole('region', { name: `Contas de ${brand.name}` });
  for (const p of ['Instagram', 'TikTok', 'YouTube']) {
    await section.getByRole('link', { name: `Ligar ${p}` }).click();
    await expect(page.getByRole('status')).toContainText('ligada');
  }
  await page.goto('/biblioteca');
  await page.getByLabel('Escolher ficheiros').setInputFiles(path.join(__dirname, 'fixtures', 'clip.mov'));
  await expect(page.getByTestId('media-item')).toHaveCount(1);
  await page.getByRole('link', { name: 'Criar post' }).click();
  for (const p of ['Instagram', 'TikTok', 'YouTube']) await page.getByLabel(new RegExp(`^${p} @`)).check();
  await page.getByLabel('Título do YouTube').fill('Fluxo completo');
  await page.getByRole('button', { name: 'Agendar' }).click();
  await page.waitForURL('**/calendario');

  // Antecipar a hora para o tick apanhar o post agora.
  const db = admin();
  await db.from('posts').update({ scheduled_at: new Date(Date.now() - 60_000).toISOString() }).eq('brand_id', brand.id);
  await runTick(request);
  await runTick(request);

  const { data: targets } = await db.from('post_targets').select('id, format, status, posts!inner(brand_id)').eq('posts.brand_id', brand.id);
  expect(Object.fromEntries(targets!.map((t) => [t.format, t.status]))).toEqual({ ig_reel: 'published', tiktok_video: 'awaiting_user', yt_short: 'awaiting_user' });

  await page.goto('/pendentes');
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('pending-item').first().getByRole('button', { name: 'Marcar como feito' }).click();
    await expect(page.getByText('Marcado como publicado.').first()).toBeVisible();
    await page.reload();
  }
  const { data: post } = await db.from('posts').select('status').eq('brand_id', brand.id).single();
  expect(post!.status).toBe('published');

  const res = await request.post('/api/cron/metrics', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBe(true);
  await page.goto('/metricas?dias=7');
  await expect(page.getByTestId('kpi').filter({ hasText: 'Visualizações' })).not.toContainText(/^Visualizações0$/);

  await page.goto('/definicoes/registo');
  await expect(page.getByTestId('log-entry').filter({ hasText: 'Publicado' }).first()).toBeVisible();
});
});
