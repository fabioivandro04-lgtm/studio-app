import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

let brand: { id: string; name: string };

async function connectAll(page: Page) {
  await page.goto('/definicoes/contas');
  const section = page.getByRole('region', { name: `Contas de ${brand.name}` });
  for (const p of ['Instagram', 'TikTok', 'YouTube']) {
    await section.getByRole('link', { name: `Ligar ${p}` }).click();
    await expect(page.getByRole('status')).toContainText('ligada');
  }
}

async function uploadVideo(page: Page) {
  await page.goto('/biblioteca');
  await page.getByLabel('Escolher ficheiros').setInputFiles(path.join(__dirname, 'fixtures', 'clip.mov'));
  await expect(page.getByTestId('media-item')).toHaveCount(1);
}

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

test('agendar o mesmo vídeo para IG, TikTok e YouTube com legendas diferentes', async ({ page }) => {
  await connectAll(page);
  await uploadVideo(page);
  await page.getByRole('link', { name: 'Criar post' }).click();
  for (const p of ['Instagram', 'TikTok', 'YouTube']) await page.getByLabel(new RegExp(`^${p} @`)).check();
  await page.getByLabel('Legenda Instagram').fill('Prazos para Portugal 🇵🇹 #estudarfora');
  await page.getByLabel('Legenda TikTok').fill('Prazos PT 2027');
  await page.getByLabel('Título do YouTube').fill('Prazos para estudar em Portugal');
  await page.getByRole('button', { name: 'Agendar' }).click();
  await page.waitForURL('**/calendario');
  const { data: targets } = await admin().from('post_targets').select('format, caption, title, posts!inner(brand_id, status)').eq('posts.brand_id', brand.id);
  expect(targets?.map((t) => t.format).sort()).toEqual(['ig_reel', 'tiktok_video', 'yt_short']);
  expect(targets?.find((t) => t.format === 'tiktok_video')?.caption).toBe('Prazos PT 2027');
});

test('erros aparecem ao vivo e bloqueiam "Agendar"', async ({ page }) => {
  await connectAll(page);
  await uploadVideo(page);
  await page.getByRole('link', { name: 'Criar post' }).click();
  await page.getByLabel(/^YouTube @/).check();
  await expect(page.getByText('O título é obrigatório no YouTube.')).toBeVisible();
  await page.getByRole('button', { name: 'Agendar' }).click();
  await expect(page).toHaveURL(/posts\/novo/);
});

test('post já em publicação abre em modo só de leitura', async ({ page }) => {
  await connectAll(page);
  await uploadVideo(page);
  const db = admin();
  const { data: media } = await db.from('media_assets').select('id').eq('brand_id', brand.id).single();
  const { data: acct } = await db.from('social_accounts').select('id').eq('brand_id', brand.id).eq('platform', 'tiktok').single();
  const { data: post } = await db.from('posts').insert({ brand_id: brand.id, status: 'publishing', scheduled_at: new Date().toISOString() }).select('id').single();
  await db.from('post_media').insert({ post_id: post!.id, media_id: media!.id, position: 0 });
  await db.from('post_targets').insert({ post_id: post!.id, social_account_id: acct!.id, format: 'tiktok_video', status: 'uploading' });
  await page.goto(`/posts/${post!.id}`);
  await expect(page.getByText('só de leitura')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agendar' })).toHaveCount(0);
});
