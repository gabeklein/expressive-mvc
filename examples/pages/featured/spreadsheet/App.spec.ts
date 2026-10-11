import { expect, test } from '../../../e2e';

test('will edit cells and recompute formulas', async ({ page, open }) => {
  await open('featured/spreadsheet');
  const table = page.locator('table');
  const td = (id: string) =>
    table.locator('tbody tr').nth(Number(id.slice(1)) - 1).locator('td').nth('ABCD'.indexOf(id[0]));

  async function enter(id: string, value: string, finish: 'Enter' | 'Escape' | 'blur' = 'Enter') {
    await td(id).locator('.cell').click();
    const input = td(id).locator('input');
    await expect(input).toBeFocused();
    await input.fill(value);
    await expect(input).toHaveValue(value);
    if (finish == 'blur') await page.getByRole('heading').click();
    else await input.press(finish);
    await expect(input).toHaveCount(0);
  }

  await expect(table.locator('thead th')).toHaveText(['', 'A', 'B', 'C', 'D']);
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(td('A1').locator('.cell')).toHaveText('');

  await enter('A1', '5');
  await expect(td('A1')).toHaveText('5');

  await enter('B1', '=A1*2+C1');
  await expect(td('B1')).toHaveText('10');

  await enter('C1', '3', 'Escape');
  await expect(td('C1')).toHaveText('3');
  await expect(td('B1')).toHaveText('13');

  await enter('A1', '7', 'blur');
  await expect(td('A1')).toHaveText('7');
  await expect(td('B1')).toHaveText('17');

  await enter('B2', '=B1/2');
  await expect(td('B2')).toHaveText('8.5');

  await enter('A1', '1');
  await expect(td('B1')).toHaveText('5');
  await expect(td('B2')).toHaveText('2.5');

  await enter('D5', 'hello');
  await expect(td('D5')).toHaveText('hello');

  await enter('D4', '=foo');
  await expect(td('D4')).toHaveText('#ERR');

  await enter('D3', '=D5+1');
  await expect(td('D3')).toHaveText('1');

  await td('A1').locator('.cell').click();
  await expect(td('A1').locator('input')).toHaveValue('1');
  await td('A1').locator('input').press('Enter');
  await expect(td('A1')).toHaveText('1');
});
