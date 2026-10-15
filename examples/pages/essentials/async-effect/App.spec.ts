import { expect, test } from '../../../e2e';

test('will queue one lookup with the latest query while one is in flight', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('essentials/async-effect');
  const tally = page.locator('.tally');
  const results = page.locator('.results li');
  const input = page.getByPlaceholder('Search names');

  await expect(page.getByRole('heading', { name: 'Async Effect' })).toBeVisible();
  await expect(tally).toHaveText('Keystrokes: 0 · Lookups: 1');

  await page.clock.runFor(600);
  await expect(results).toHaveCount(5);

  await input.pressSequentially('a');
  await expect(tally).toHaveText('Keystrokes: 1 · Lookups: 2');

  await input.pressSequentially('da');
  await expect(tally).toHaveText('Keystrokes: 3 · Lookups: 2');

  await page.clock.runFor(600);
  await expect(tally).toHaveText('Keystrokes: 3 · Lookups: 3');

  await page.clock.runFor(600);
  await expect(results).toHaveText(['Ada Lovelace']);
  await expect(tally).toHaveText('Keystrokes: 3 · Lookups: 3');
});
