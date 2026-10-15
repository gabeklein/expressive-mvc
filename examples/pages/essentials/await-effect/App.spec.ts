import { expect, test } from '../../../e2e';

test('will wait for the link before sending', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('essentials/await-effect');
  const status = page.locator('.result');

  await expect(page.getByRole('heading', { name: 'Await an Effect' })).toBeVisible();
  await expect(status).toHaveText('Not sent');

  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(status).toHaveText('Waiting for the link…');

  await page.clock.runFor(2000);
  await expect(status).toHaveText('Sent https://expressive.dev/join/7f3a');
});

test('will send at once when the link already exists', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('essentials/await-effect');

  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.locator('.result')).toHaveText('Sent https://expressive.dev/join/7f3a');
});
