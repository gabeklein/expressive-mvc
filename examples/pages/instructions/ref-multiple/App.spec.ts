import { expect, test } from '../../../e2e';

test('will wire every fader from the state keys', async ({ page, open }) => {
  await open('instructions/ref-multiple');
  const bands = page.locator('.desk label span');
  const outputs = page.locator('.desk label output');
  const faders = page.locator('.desk label input');
  const fader = (band: string) => page.locator('.desk label').filter({ hasText: band }).locator('input');

  await expect(bands).toHaveText(['bass', 'mids', 'treble', 'air']);
  await expect(outputs).toHaveText(['40', '65', '30', '55']);
  for (const input of await faders.all()) {
    await expect(input).toHaveAttribute('type', 'range');
    await expect(input).toHaveAttribute('min', '0');
    await expect(input).toHaveAttribute('max', '100');
  }

  await fader('mids').focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  await expect(fader('mids')).toHaveValue('80');
  await expect(outputs).toHaveText(['40', '80', '30', '55']);

  await page.getByRole('button', { name: '+10 all' }).click();
  await expect(outputs).toHaveText(['50', '90', '40', '65']);
  await expect(fader('treble')).toHaveValue('40');

  await page.getByRole('button', { name: '+10 all' }).click();
  await expect(outputs).toHaveText(['60', '100', '50', '75']);

  await page.getByRole('button', { name: '−10 all' }).click();
  await expect(outputs).toHaveText(['50', '90', '40', '65']);

  await page.getByRole('button', { name: 'Flatten' }).click();
  await expect(outputs).toHaveText(['50', '50', '50', '50']);
  await expect(fader('bass')).toHaveValue('50');

  await fader('air').focus();
  await page.keyboard.press('Home');
  await expect(outputs).toHaveText(['50', '50', '50', '0']);

  await page.getByRole('button', { name: '−10 all' }).click();
  await expect(outputs).toHaveText(['40', '40', '40', '0']);
  await expect(fader('air')).toHaveValue('0');
});
