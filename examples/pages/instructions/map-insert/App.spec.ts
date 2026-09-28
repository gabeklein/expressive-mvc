import { expect, test } from '../../../e2e';

test('will bump, add and clamp entries', async ({ page, open }) => {
  await open('instructions/map-insert');
  const names = page.locator('.stock li .name');
  const counts = page.locator('.stock li output');
  const footer = page.locator('footer small');
  const input = page.getByPlaceholder('Add or bump an item…');
  const row = (name: string) => page.locator('.stock li').filter({ hasText: name });

  await expect(names).toHaveText(['apples', 'bread', 'milk']);
  await expect(counts).toHaveText(['3', '1', '2']);
  await expect(footer).toHaveText('3 items · 6 in stock');

  await row('apples').getByRole('button', { name: '+' }).click();
  await expect(counts).toHaveText(['4', '1', '2']);
  await expect(footer).toHaveText('3 items · 7 in stock');

  await row('bread').getByRole('button', { name: '−' }).click();
  await row('bread').getByRole('button', { name: '−' }).click();
  await expect(counts).toHaveText(['4', '0', '2']);
  await expect(footer).toHaveText('3 items · 6 in stock');

  await input.fill('  Milk ');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(names).toHaveText(['apples', 'bread', 'milk']);
  await expect(counts).toHaveText(['4', '0', '3']);
  await expect(footer).toHaveText('3 items · 7 in stock');

  await input.fill('Eggs');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(input).toHaveValue('');
  await expect(names).toHaveText(['apples', 'bread', 'milk', 'eggs']);
  await expect(counts).toHaveText(['4', '0', '3', '1']);
  await expect(footer).toHaveText('4 items · 8 in stock');

  await input.fill('   ');
  await input.press('Enter');
  await expect(input).toHaveValue('   ');
  await expect(names).toHaveCount(4);
  await expect(footer).toHaveText('4 items · 8 in stock');
});
