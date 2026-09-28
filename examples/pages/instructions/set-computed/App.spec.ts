import { expect, test } from '../../../e2e';

test('will recompute totals from each input', async ({ page, open }) => {
  await open('instructions/set-computed');
  const hours = page.getByLabel('Hours');
  const rate = page.getByLabel('Rate');
  const discount = page.getByLabel('Discount');
  const discountLabel = page.locator('label').filter({ hasText: 'Discount' });
  const gross = page.locator('footer span');
  const net = page.locator('footer b');

  await expect(hours).toHaveValue('12');
  await expect(rate).toHaveValue('85');
  await expect(discount).toHaveValue('10');
  await expect(discountLabel).toHaveText('Discount 10%');
  await expect(gross).toHaveText('$1020.00');
  await expect(net).toHaveText('$918.00');

  await hours.fill('10');
  await expect(gross).toHaveText('$850.00');
  await expect(net).toHaveText('$765.00');

  await rate.fill('100');
  await expect(gross).toHaveText('$1000.00');
  await expect(net).toHaveText('$900.00');

  await discount.focus();
  await page.keyboard.press('End');
  await expect(discount).toHaveValue('50');
  await expect(discountLabel).toHaveText('Discount 50%');
  await expect(net).toHaveText('$500.00');

  await page.keyboard.press('Home');
  await expect(discountLabel).toHaveText('Discount 0%');
  await expect(gross).toHaveText('$1000.00');
  await expect(net).toHaveText('$1000.00');

  await page.keyboard.press('ArrowRight');
  await expect(discountLabel).toHaveText('Discount 1%');
  await expect(net).toHaveText('$990.00');
});
