import { expect, test } from '../../../e2e';

test('will push and undo list entries', async ({ page, open }) => {
  await open('instructions/has-list');
  const indices = page.locator('ol.entries > li .idx');
  const entries = page.locator('ol.entries > li .entry');
  const footer = page.locator('footer small');
  const input = page.getByPlaceholder('Record an action…');
  const push = page.getByRole('button', { name: 'Push' });
  const undo = page.getByRole('button', { name: 'Undo' });

  await expect(indices).toHaveText(['0']);
  await expect(entries).toHaveText(['open document']);
  await expect(footer).toHaveText('1 entries · latest: open document');
  await expect(undo).toBeEnabled();

  await input.fill('   ');
  await push.click();
  await expect(entries).toHaveCount(1);

  await input.fill(' type heading ');
  await push.click();
  await expect(input).toHaveValue('');
  await expect(indices).toHaveText(['0', '1']);
  await expect(entries).toHaveText(['open document', 'type heading']);
  await expect(footer).toHaveText('2 entries · latest: type heading');

  await input.fill('bold text');
  await input.press('Enter');
  await expect(indices).toHaveText(['0', '1', '2']);
  await expect(entries).toHaveText(['open document', 'type heading', 'bold text']);
  await expect(footer).toHaveText('3 entries · latest: bold text');

  await undo.click();
  await expect(entries).toHaveText(['open document', 'type heading']);
  await expect(footer).toHaveText('2 entries · latest: type heading');

  await undo.click();
  await expect(entries).toHaveText(['open document']);
  await undo.click();
  await expect(entries).toHaveCount(0);
  await expect(footer).toHaveText('0 entries · latest: —');
  await expect(undo).toBeDisabled();

  await input.fill('reopen');
  await push.click();
  await expect(indices).toHaveText(['0']);
  await expect(entries).toHaveText(['reopen']);
  await expect(undo).toBeEnabled();
});
