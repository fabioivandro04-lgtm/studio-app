import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner, runTick } from './helpers';

let brand: { id: string; name: string };

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

async function scheduleNow(page: Page, platform: 'tiktok' | 'instagram', options: Record<string, unknown> = {}) {
  await page.goto('/definicoes/contas');
  await page.getByRole('region', { name: `Contas de ${brand.name}` }).getByRole('link', { name: platform === 'tiktok' ? 'Ligar TikTok' : 'Ligar Instagram' }).click();
  await page.goto('/biblioteca');
  await page.getByLabel('Escolher ficheiros').setInputFiles(path.join(__dirname, 'fixtures', 'clip.mov'));
  await expect(page.getByTestId('media-item')).toHaveCount(1);
  const db = admin();
  const { data: media } = await db.from('media_assets').select('id').eq('brand_id', brand.id).single();
  const { data: acct } = await db.from('social_accounts').select('id').eq('brand_id', brand.id).eq('platform', platform).single();
  const { data: post } = await db.from('posts').insert({ brand_id: brand.id, internal_title: 'Pendente E2E', status: 'scheduled', scheduled_at: new Date(Date.now() - 60_000).toISOString() }).select('id').single();
  await db.from('post_media').insert({ post_id: post!.id, media_id: media!.id, position: 0 });
  await db.from('post_targets').insert({ post_id: post!.id, social_account_id: acct!.id, format: platform === 'tiktok' ? 'tiktok_video' : 'ig_reel', caption: 'Legenda TT', options });
  return post!.id as string;
}

test('após o tick, TikTok aparece como "Aguarda 1 toque" com Copiar legenda; marcar como feito publica', async ({ page, request }) => {
  const postId = await scheduleNow(page, 'tiktok');
  await runTick(request);
  await runTick(request);
  await page.goto('/pendentes');
  const item = page.getByTestId('pending-item').first();
  await expect(item).toContainText('Aguarda 1 toque');
  await expect(item.getByRole('button', { name: 'Copiar legenda' })).toBeVisible();
  await item.getByRole('button', { name: 'Marcar como feito' }).click();
  await expect(page.getByText('Marcado como publicado.')).toBeVisible();
  const { data } = await admin().from('posts').select('status').eq('id', postId).single();
  expect(data!.status).toBe('published');
});

test('falha permanente mostra o motivo e "Tentar de novo" volta a agendar', async ({ page, request }) => {
  const postId = await scheduleNow(page, 'instagram', { fake: 'fail_permanent' });
  await runTick(request);
  await page.goto('/pendentes');
  const item = page.getByTestId('pending-item').first();
  await expect(item).toContainText('Falha simulada');
  await item.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByText('Vai ser tentado de novo')).toBeVisible();
  const { data } = await admin().from('posts').select('status').eq('id', postId).single();
  expect(data!.status).toBe('scheduled');
});

test('Associar vídeo lista candidatos e associa', async ({ page, request }) => {
  await scheduleNow(page, 'tiktok');
  await runTick(request);
  await runTick(request);
  await page.goto('/pendentes');
  const item = page.getByTestId('pending-item').first();
  await item.getByRole('button', { name: 'Associar vídeo' }).click();
  await item.getByRole('list', { name: 'Vídeos recentes' }).getByRole('button', { name: 'Associar' }).click();
  await expect(page.getByText('Vídeo associado.')).toBeVisible();
});
