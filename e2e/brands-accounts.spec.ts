import { expect, test } from '@playwright/test';
import { admin, cleanupBrand, createTestBrand, loginAsOwner } from './helpers';

test('criar marca com fuso padrão Maputo', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/definicoes/marcas');
  const form = page.getByRole('form', { name: 'Nova marca' });
  await expect(form.getByLabel('Fuso horário')).toHaveValue('Africa/Maputo');
  const name = `E2E Marca ${Date.now()}`;
  await form.getByLabel('Nome').fill(name);
  await form.getByRole('button', { name: 'Criar marca' }).click();
  await expect(page.getByRole('form', { name: `Marca ${name}` })).toBeVisible();
  const { data } = await admin().from('brands').select('id').eq('name', name).single();
  await cleanupBrand(data!.id);
});

test('ligar TikTok falso mostra a conta ligada e aviso de reautenticação', async ({ page }) => {
  const brand = await createTestBrand();
  try {
    await loginAsOwner(page);
    await page.goto('/definicoes/contas');
    const section = page.getByRole('region', { name: `Contas de ${brand.name}` });
    await section.getByRole('link', { name: 'Ligar TikTok' }).click();
    await expect(page.getByRole('status')).toContainText('TikTok ligada');
    await expect(section).toContainText('@fake_tiktok');

    await admin().from('social_accounts').update({ status: 'needs_reauth' }).eq('brand_id', brand.id);
    await page.reload();
    await expect(page.getByRole('alert').first()).toContainText('Volte a ligar');
  } finally {
    await cleanupBrand(brand.id);
  }
});

test('não deixa desligar conta com posts agendados', async ({ page }) => {
  const brand = await createTestBrand();
  const db = admin();
  try {
    const { data: acct } = await db.from('social_accounts').insert({
      brand_id: brand.id, platform: 'tiktok', external_id: `x${Date.now()}`, handle: 'agendada', display_name: 'A', access_token_enc: 'v1.a.b',
    }).select('id').single();
    const { data: post } = await db.from('posts').insert({ brand_id: brand.id, status: 'scheduled', scheduled_at: new Date(Date.now() + 86_400_000).toISOString() }).select('id').single();
    await db.from('post_targets').insert({ post_id: post!.id, social_account_id: acct!.id, format: 'tiktok_video' });
    await loginAsOwner(page);
    await page.goto('/definicoes/contas');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('region', { name: `Contas de ${brand.name}` }).getByRole('button', { name: 'Desligar' }).click();
    await expect(page.getByText('Esta conta tem posts agendados')).toBeVisible();
  } finally {
    await cleanupBrand(brand.id);
  }
});
