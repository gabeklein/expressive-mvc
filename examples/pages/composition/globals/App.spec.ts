import { expect, test } from '../../../e2e';

test('will reach globals without a provider and update only the reader', async ({ page, open }) => {
  await open('composition/globals');
  const card = (name: string) => page.locator('.card', { has: page.getByRole('heading', { name }) });
  const viewport = card('Viewport');
  const session = card('Session');
  const theme = card('Theme');
  const html = page.locator('html');

  const width = await page.evaluate(() => window.innerWidth);
  await expect(viewport.locator('b')).toHaveText(`${width}px`);
  await expect(session.locator('b')).toHaveText('signed out');

  const initial = (await theme.locator('b').textContent())!;
  const flipped = initial == 'dark' ? 'light' : 'dark';
  expect(['dark', 'light']).toContain(initial);
  await expect(html).toHaveAttribute('data-theme', initial);

  await page.setViewportSize({ width: 480, height: 720 });
  await expect(viewport.locator('b')).toHaveText('480px');
  await expect(viewport.locator('small')).toHaveText('compact layout');

  await page.setViewportSize({ width: 900, height: 720 });
  await expect(viewport.locator('b')).toHaveText('900px');
  await expect(viewport.locator('small')).toHaveText('wide layout');

  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(session.locator('b')).toHaveText('Ada');
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(session.locator('b')).toHaveText('signed out');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch' }).click();
  await expect(theme.locator('b')).toHaveText(flipped);
  await expect(html).toHaveAttribute('data-theme', flipped);

  await page.getByRole('button', { name: 'Switch' }).click();
  await expect(theme.locator('b')).toHaveText(initial);
  await expect(html).toHaveAttribute('data-theme', initial);
  await expect(viewport.locator('b')).toHaveText('900px');
  await expect(session.locator('b')).toHaveText('signed out');
});
