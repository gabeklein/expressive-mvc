import { expect, test } from '../../../e2e';

test('will compose subclass render inside base chrome with independent state', async ({ page, open }) => {
  await open('composition/extension');
  const tallyHead = page.getByRole('button', { name: /^Tally/ });
  const notesHead = page.getByRole('button', { name: /^Notes/ });
  const output = page.locator('.tally output');
  const notes = page.getByPlaceholder('Type something, then collapse…');

  await expect(page.locator('.panel')).toHaveCount(2);
  await expect(tallyHead).toHaveAttribute('aria-expanded', 'true');
  await expect(tallyHead.locator('span')).toHaveText('–');
  await expect(output).toHaveText('3');

  await page.getByRole('button', { name: '+', exact: true }).click();
  await page.getByRole('button', { name: '+', exact: true }).click();
  await expect(output).toHaveText('5');
  await page.getByRole('button', { name: '−', exact: true }).click();
  await expect(output).toHaveText('4');

  await notes.fill('remember me');
  await expect(notes).toHaveValue('remember me');

  await notesHead.click();
  await expect(notesHead).toHaveAttribute('aria-expanded', 'false');
  await expect(notesHead.locator('span')).toHaveText('+');
  await expect(notes).toHaveCount(0);
  await expect(tallyHead).toHaveAttribute('aria-expanded', 'true');
  await expect(output).toHaveText('4');

  await page.getByRole('button', { name: '+', exact: true }).click();
  await expect(output).toHaveText('5');

  await notesHead.click();
  await expect(notesHead).toHaveAttribute('aria-expanded', 'true');
  await expect(notes).toHaveValue('remember me');

  await tallyHead.click();
  await expect(output).toHaveCount(0);
  await tallyHead.click();
  await expect(output).toHaveText('5');
});
