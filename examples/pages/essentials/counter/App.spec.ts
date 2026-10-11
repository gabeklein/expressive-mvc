import { expect, test } from '../../../e2e';

test('will increment, decrement and reset', async ({ page, open }) => {
  await open('essentials/counter');
  const current = page.locator('pre');

  await expect(current).toHaveText('1');
  await page.getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: '+' }).click();
  await expect(current).toHaveText('3');

  await page.getByRole('button', { name: '−' }).click();
  await expect(current).toHaveText('2');

  await current.click();
  await expect(current).toHaveText('1');
});
