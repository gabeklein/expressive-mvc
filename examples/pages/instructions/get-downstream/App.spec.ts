import { expect, test } from '../../../e2e';

test('will collect candidates below and vet write-ins', async ({ page, open }) => {
  await open('instructions/get-downstream');
  const tally = page.locator('.tally');
  const items = page.locator('li.candidate');
  const names = items.locator('span');
  const chosen = page.locator('li.candidate.chosen span');
  const item = (name: string) => items.filter({ has: page.getByText(name, { exact: true }) });
  const choose = (name: string) => item(name).getByText(name, { exact: true }).click();
  const remove = (name: string) => item(name).getByRole('button', { name: '×' }).click();

  await expect(tally).toHaveText('3 on the roster · chose —');
  await expect(names).toHaveText(['Ada', 'Alan', 'Grace']);
  await expect(chosen).toHaveCount(0);

  await choose('Alan');
  await expect(tally).toHaveText('3 on the roster · chose Alan');
  await expect(chosen).toHaveText(['Alan']);

  const input = page.getByPlaceholder('Add a write-in');
  await input.fill('  Linus ');
  await expect(input).toHaveValue('  Linus ');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(input).toHaveValue('');
  await expect(names).toHaveText(['Ada', 'Alan', 'Grace', 'Linus']);
  await expect(item('Linus').locator('em')).toHaveText('write-in');
  await expect(item('Ada').locator('em')).toHaveCount(0);
  await expect(tally).toHaveText('3 on the roster · chose Alan');

  await input.press('Enter');
  await expect(names).toHaveText(['Ada', 'Alan', 'Grace', 'Linus', 'Anonymous']);
  await expect(tally).toHaveText('3 on the roster · chose Alan');

  await choose('Linus');
  await expect(chosen).toHaveText(['Linus']);
  await expect(tally).toHaveText('3 on the roster · chose Linus');

  await remove('Ada');
  await expect(names).toHaveText(['Alan', 'Grace', 'Linus', 'Anonymous']);
  await expect(tally).toHaveText('2 on the roster · chose Linus');
  await expect(chosen).toHaveText(['Linus']);

  await remove('Linus');
  await expect(names).toHaveText(['Alan', 'Grace', 'Anonymous']);
  await expect(tally).toHaveText('2 on the roster · chose —');
  await expect(chosen).toHaveCount(0);

  await choose('Grace');
  await remove('Grace');
  await expect(names).toHaveText(['Alan', 'Anonymous']);
  await expect(tally).toHaveText('1 on the roster · chose —');
});
