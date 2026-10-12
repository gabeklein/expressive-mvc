import { expect, test } from '../../../e2e';

test('will add, toggle, filter, edit and clear todos', async ({ page, open }) => {
  await open('featured/todomvc');
  const entry = page.getByPlaceholder('What needs to be done?');
  const rows = page.locator('ul.list > li');
  const row = (text: string) => rows.filter({ hasText: text });
  const count = page.locator('.footer .count');
  const tab = (name: string) => page.locator('.filters a', { hasText: name });

  await expect(rows).toHaveText(['Taste JavaScript', 'Buy a unicorn'].map((t) => new RegExp(t)));
  await expect(row('Taste JavaScript')).toHaveClass('done');
  await expect(count).toHaveText('1 item left');
  await expect(tab('All')).toHaveClass('selected');

  await entry.fill('  Walk the dog  ');
  await entry.press('Enter');
  await expect(entry).toHaveValue('');
  await expect(rows.last()).toContainText('Walk the dog');
  await expect(count).toHaveText('2 items left');

  await entry.press('Enter');
  await expect(rows).toHaveCount(3);

  await row('Buy a unicorn').locator('.toggle').check();
  await expect(row('Buy a unicorn')).toHaveClass('done');
  await expect(count).toHaveText('1 item left');

  await tab('Active').click();
  await expect(tab('Active')).toHaveClass('selected');
  await expect(tab('All')).not.toHaveClass('selected');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Walk the dog');

  await tab('Completed').click();
  await expect(rows).toHaveCount(2);

  await tab('All').click();
  await expect(rows).toHaveCount(3);

  await row('Walk the dog').locator('label').dblclick();
  const edit = page.locator('li.editing input.edit');
  await expect(edit).toBeFocused();
  await expect(edit).toHaveValue('Walk the dog');
  await edit.fill('Walk the cat');
  await edit.press('Enter');
  await expect(edit).toHaveCount(0);
  await expect(rows.last()).toContainText('Walk the cat');

  await row('Walk the cat').locator('label').dblclick();
  await edit.fill('discarded');
  await edit.press('Escape');
  await expect(rows.last()).toContainText('Walk the cat');

  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Clear completed' })).toHaveCount(0);

  await page.getByLabel('Toggle all').check();
  await expect(row('Walk the cat')).toHaveClass('done');
  await expect(count).toHaveText('0 items left');
  await page.getByLabel('Toggle all').uncheck();
  await expect(count).toHaveText('1 item left');

  await row('Walk the cat').locator('label').dblclick();
  await edit.fill('');
  await edit.press('Enter');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('.footer')).toHaveCount(0);
  await expect(entry).toBeVisible();
});

test('will destroy a todo from its row', async ({ page, open }) => {
  await open('featured/todomvc');
  const rows = page.locator('ul.list > li');

  await rows.first().hover();
  await rows.first().locator('.destroy').click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Buy a unicorn');
  await expect(page.locator('.footer .count')).toHaveText('1 item left');
});
