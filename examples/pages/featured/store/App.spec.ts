import { expect, test } from '../../../e2e';

test('will browse, fill and check out a keyed cart', async ({ page, open }) => {
  await open('featured/store');
  const badge = page.locator('.cart-btn .badge');
  const cards = page.locator('.grid .card');
  const lines = page.locator('.lines .line');
  const line = (name: string) => lines.filter({ hasText: name });
  const total = page.locator('.summary .total');

  const all = await cards.count();
  await expect(badge).toHaveCount(0);

  await page.locator('.chips .chip').nth(1).click();
  await expect(page.locator('.chips .chip.on')).not.toHaveText('All');
  expect(await cards.count()).toBeLessThan(all);

  await cards.first().click();
  const name = (await page.locator('.hero h2').textContent())!;
  await expect(page.locator('.crumbs [aria-current]')).toHaveText(name);

  const stepper = page.locator('.hero .qty');
  await stepper.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(stepper.locator('.qty-val')).toHaveText('1');
  await stepper.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(stepper.locator('.qty-val')).toHaveText('2');

  await page.getByRole('button', { name: /^Add 2 to cart/ }).click();
  await expect(badge).toHaveText('2');
  await expect(stepper.locator('.qty-val')).toHaveText('1');

  await page.getByRole('button', { name: /^Add 1 to cart/ }).click();
  await expect(badge).toHaveText('3');

  await page.locator('.crumbs a').first().click();
  await cards.nth(1).click();
  const other = (await page.locator('.hero h2').textContent())!;
  await page.getByRole('button', { name: /^Add 1 to cart/ }).click();
  await expect(badge).toHaveText('4');

  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(lines).toHaveCount(2);
  await expect(line(name).locator('.qty-val')).toHaveText('3');
  const before = await total.textContent();

  await line(name).getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(line(name).locator('.qty-val')).toHaveText('2');
  await expect(badge).toHaveText('3');
  await expect(total).not.toHaveText(before!);

  await line(other).getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(lines).toHaveCount(1);
  await expect(badge).toHaveText('2');

  await page.getByRole('button', { name: /^Checkout/ }).click();
  await expect(page.getByRole('heading', { name: 'Order placed!' })).toBeVisible();
  await expect(page.locator('.notice p')).toContainText('2 items');
  await expect(badge).toHaveCount(0);

  await page.getByRole('link', { name: 'Continue shopping' }).click();
  await expect(cards).toHaveCount(all);

  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('will remove a line outright', async ({ page, open }) => {
  await open('featured/store');

  await page.locator('.grid .card').first().click();
  const name = (await page.locator('.hero h2').textContent())!;
  await page.getByRole('button', { name: /^Add 1 to cart/ }).click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('button', { name: `Remove ${name}` }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await expect(page.locator('.cart-btn .badge')).toHaveCount(0);
});
