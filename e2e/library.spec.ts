import path from 'node:path';
import { expect, test } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

const fx = (f: string) => path.join(__dirname, 'fixtures', f);
let brand: { id: string; name: string };

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
  await page.goto('/biblioteca');
});
test.afterEach(async () => {
  const db = admin();
  const { data } = await db.from('media_assets').select('storage_path, thumbnail_path').eq('brand_id', brand.id);
  const paths = (data ?? []).flatMap((m) => [m.storage_path, m.thumbnail_path].filter(Boolean));
  if (paths.length) await db.storage.from('media').remove(paths);
  await cleanupBrand(brand.id);
});

const items = (page: import('@playwright/test').Page) => page.getByTestId('media-item');

test('PNG é convertido e aparece como JPEG na biblioteca', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles(fx('photo.png'));
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('JPEG');
  await expect(items(page).first()).toContainText('400×500');
});

test('vídeo vertical mostra duração e miniatura', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles(fx('clip-vertical.webm'));
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().getByTestId('duration')).toHaveText('0:04');
  await expect(items(page).first().locator('img')).toBeVisible();
});

test('MOV do iPhone é aceite', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles(fx('clip.mov'));
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText('clip.mov');
});

test('HEIC no Chromium mostra a mensagem de formato não suportado', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles(fx('photo.heic'));
  await expect(page.getByText('exporte como JPEG')).toBeVisible();
  await expect(items(page)).toHaveCount(0);
});

test('ficheiro acima de 50 MB é recusado antes do upload', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles({ name: 'grande.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(51 * 1024 * 1024) });
  await expect(page.getByText('o limite é 50 MB')).toBeVisible();
  await expect(items(page)).toHaveCount(0);
});

test('apagar mídia usada num post mostra aviso e não apaga', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles(fx('photo.png'));
  await expect(items(page)).toHaveCount(1);
  const db = admin();
  const { data: media } = await db.from('media_assets').select('id').eq('brand_id', brand.id).single();
  const { data: post } = await db.from('posts').insert({ brand_id: brand.id }).select('id').single();
  await db.from('post_media').insert({ post_id: post!.id, media_id: media!.id, position: 0 });
  page.once('dialog', (d) => d.accept());
  await items(page).first().getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: 'Apagar' }).click();
  await expect(page.getByText('Esta mídia está num post')).toBeVisible();
  await expect(items(page)).toHaveCount(1);
});

test('filtrar por etiqueta', async ({ page }) => {
  await page.getByLabel('Escolher ficheiros').setInputFiles([fx('photo.png'), fx('clip.mov')]);
  await expect(items(page)).toHaveCount(2);
  const db = admin();
  await db.from('media_assets').update({ tags: ['portugal'] }).eq('brand_id', brand.id).eq('kind', 'image');
  await page.reload();
  await page.getByRole('link', { name: '#portugal' }).click();
  await expect(items(page)).toHaveCount(1);
});
