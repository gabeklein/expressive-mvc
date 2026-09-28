import { expect, test } from '../../../e2e';

test('will reject long names and debounce the search', async ({ page, open }) => {
  await page.clock.install();
  await open('instructions/set');
  const name = page.getByLabel('Display name');
  const query = page.getByLabel('Search');
  const result = page.locator('p.result');

  await expect(name).toHaveValue('guest');
  await expect(query).toHaveValue('');
  await expect(result).toHaveText('idle');

  await name.fill('Ada Lovelace');
  await expect(name).toHaveValue('Ada Lovelace');

  await name.press('End');
  await name.press('!');
  await expect(name).toHaveValue('Ada Lovelace');

  await name.fill('Ada Lovelace, Countess');
  await expect(name).toHaveValue('Ada Lovelace');

  await name.fill('Ada');
  await expect(name).toHaveValue('Ada');

  await query.fill('ex');
  await expect(query).toHaveValue('ex');
  await expect(result).toHaveText('typing…');

  await page.clock.runFor(200);
  await query.pressSequentially('pr');
  await expect(query).toHaveValue('expr');
  await expect(result).toHaveText('typing…');

  await page.clock.runFor(350);
  await expect(result).toHaveText('typing…');

  await page.clock.runFor(200);
  await expect(result).toHaveText('searching “expr”');

  await query.fill('');
  await expect(result).toHaveText('typing…');
  await page.clock.runFor(550);
  await expect(result).toHaveText('idle');
});
