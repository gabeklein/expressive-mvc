import { expect, test } from '../../../e2e';

test('will share owned children with descendants and drop them on close', async ({ page, open }) => {
  await open('composition/nested');
  const undo = page.getByRole('button', { name: /^Undo/ });
  const words = page.locator('.toolbar small');
  const sheet = page.getByPlaceholder('Write something, then undo it…');

  await expect(undo).toBeDisabled();
  await expect(undo).toHaveText('Undo');
  await expect(words).toHaveText('0 words');
  await expect(sheet).toHaveValue('');

  await sheet.fill('hello');
  await expect(words).toHaveText('1 words');
  await expect(undo).toBeEnabled();
  await expect(undo).toHaveText('Undo 1');

  await sheet.fill('hello world');
  await expect(words).toHaveText('2 words');
  await expect(undo).toHaveText('Undo 2');

  await undo.click();
  await expect(sheet).toHaveValue('hello');
  await expect(words).toHaveText('1 words');
  await expect(undo).toHaveText('Undo 1');

  await undo.click();
  await expect(sheet).toHaveValue('');
  await expect(words).toHaveText('0 words');
  await expect(undo).toBeDisabled();

  await sheet.fill('draft text here');
  await expect(words).toHaveText('3 words');
  await expect(undo).toHaveText('Undo 1');

  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(page.locator('.editor')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open editor' }).click();
  await expect(sheet).toHaveValue('');
  await expect(words).toHaveText('0 words');
  await expect(undo).toBeDisabled();
  await expect(undo).toHaveText('Undo');
  await expect(page.getByRole('button', { name: 'Close editor' })).toBeVisible();
});
