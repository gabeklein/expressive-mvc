import { expect, test } from '../../../e2e';

test('will provide a map and update each reader by field', async ({ page, open }) => {
  await open('composition/context');
  const greeting = page.locator('.greeting');
  const badge = page.locator('.badge');
  const total = page.locator('.total');

  await expect(page.locator('.shelf button')).toHaveText(['Espresso $3', 'Cortado $4', 'Pour-over $5']);
  await expect(greeting).toHaveText('Ada is on bar');
  await expect(badge).toHaveText('0 in cart');
  await expect(total).toHaveText('Total $0');

  await page.getByRole('button', { name: /Espresso/ }).click();
  await expect(badge).toHaveText('1 in cart');
  await expect(total).toHaveText('Total $3');

  await page.getByRole('button', { name: /Cortado/ }).click();
  await page.getByRole('button', { name: /Pour-over/ }).click();
  await expect(badge).toHaveText('3 in cart');
  await expect(total).toHaveText('Total $12');
  await expect(greeting).toHaveText('Ada is on bar');
});
