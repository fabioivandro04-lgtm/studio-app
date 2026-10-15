import { expect, test } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

let brand: { id: string; name: string };

test.beforeEach(async ({ page, context }) => {
  brand = await createTestBrand();
  await context.addCookies([{ name: 'brand', value: brand.id, url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await loginAsOwner(page);
});
test.afterEach(async () => {
  await cleanupBrand(brand.id);
});

test('KPIs usam a última linha de cada post e o top 5 está por ordem', async ({ page }) => {
  const db = admin();
  const { data: acct } = await db.from('social_accounts').insert({ brand_id: brand.id, platform: 'instagram', external_id: `m${Date.now()}`, handle: 'uni', display_name: 'U', access_token_enc: 'v1.a.b' }).select('id').single();
  const { data: post } = await db.from('posts').insert({ brand_id: brand.id, internal_title: 'Top', status: 'published' }).select('id').single();
  const { data: t1 } = await db.from('post_targets').insert({ post_id: post!.id, social_account_id: acct!.id, format: 'ig_image', status: 'published' }).select('id').single();
  const { data: post2 } = await db.from('posts').insert({ brand_id: brand.id, internal_title: 'Segundo', status: 'published' }).select('id').single();
  const { data: t2 } = await db.from('post_targets').insert({ post_id: post2!.id, social_account_id: acct!.id, format: 'ig_image', status: 'published' }).select('id').single();
  const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  await db.from('post_metrics').insert([
    { post_target_id: t1!.id, collected_on: d(2), views: 100, likes: 5 },
    { post_target_id: t1!.id, collected_on: d(1), views: 300, likes: 9 },
    { post_target_id: t2!.id, collected_on: d(1), views: 50, likes: 1 },
  ]);
  await db.from('account_metrics').insert([
    { social_account_id: acct!.id, collected_on: d(3), followers: 1000 },
    { social_account_id: acct!.id, collected_on: d(1), followers: 1040 },
  ]);
  await page.goto('/metricas?dias=7');
  await expect(page.getByTestId('kpi').filter({ hasText: 'Visualizações' })).toContainText('350');
  await expect(page.getByTestId('kpi').filter({ hasText: 'Seguidores ganhos' })).toContainText('40');
  await expect(page.getByTestId('top-posts').locator('li').first()).toContainText('Top');
});
