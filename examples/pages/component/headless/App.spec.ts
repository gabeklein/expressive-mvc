import { expect, test } from '../../../e2e';

test('will tick two scopes at their own rates', async ({ page, open }) => {
  await page.clock.install();
  await open('component/headless');
  const readouts = page.locator('.pair > .readout');
  const [fast, slow] = [readouts.nth(0).locator('strong'), readouts.nth(1).locator('strong')];

  await expect(readouts).toHaveCount(2);
  await expect(page.locator('.readout small')).toHaveText(['every 100ms', 'every 1000ms']);
  await expect(fast).toHaveText('0.0s');
  await expect(slow).toHaveText('0.0s');

  await page.clock.runFor(450);
  await expect(fast).toHaveText('0.4s');
  await expect(slow).toHaveText('0.0s');

  await page.clock.runFor(700);
  await expect(fast).toHaveText('1.1s');
  await expect(slow).toHaveText('1.0s');
});
