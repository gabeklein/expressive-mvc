import { expect, test } from '../../../e2e';

test('will add, toggle, clear and remove pooled todos', async ({ page, open }) => {
  await open('instructions/has');
  const rows = page.locator('.card ul > li');
  const texts = rows.locator('span');
  const footer = page.locator('.card footer small');
  const input = page.getByPlaceholder('Add a task…');
  const add = page.getByRole('button', { name: 'add' });

  await expect(texts).toHaveText(['Learn Expressive']);
  await expect(footer).toHaveText('1 of 1 left');

  await add.click();
  await expect(texts).toHaveText(['Learn Expressive']);

  await input.fill('Buy milk');
  await add.click();
  await expect(input).toHaveValue('');
  await expect(texts).toHaveText(['Learn Expressive', 'Buy milk']);
  await expect(footer).toHaveText('2 of 2 left');

  await input.fill('Walk dog');
  await input.press('Enter');
  await expect(texts).toHaveText(['Learn Expressive', 'Buy milk', 'Walk dog']);
  await expect(footer).toHaveText('3 of 3 left');

  await rows.nth(0).getByRole('button', { name: 'toggle' }).click();
  await expect(rows.nth(0)).toHaveClass('done');
  await expect(footer).toHaveText('2 of 3 left');

  await page.getByText('Walk dog').click();
  await expect(rows.nth(2)).toHaveClass('done');
  await expect(footer).toHaveText('1 of 3 left');

  await page.getByText('Walk dog').click();
  await expect(rows.nth(2)).not.toHaveClass('done');
  await expect(footer).toHaveText('2 of 3 left');

  await page.getByRole('button', { name: 'Clear done' }).click();
  await expect(texts).toHaveText(['Buy milk', 'Walk dog']);
  await expect(footer).toHaveText('2 of 2 left');

  await rows.nth(0).getByRole('button', { name: 'remove' }).click();
  await expect(texts).toHaveText(['Walk dog']);
  await expect(footer).toHaveText('1 of 1 left');

  await rows.nth(0).getByRole('button', { name: 'remove' }).click();
  await expect(rows).toHaveCount(0);
  await expect(footer).toHaveText('0 of 0 left');
});
