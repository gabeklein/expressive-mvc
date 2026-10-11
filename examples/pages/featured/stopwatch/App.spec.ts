import { expect, test } from '../../../e2e';

test('will start, stop and reset', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('featured/stopwatch');
  const time = page.locator('.time');
  const toggle = page.getByRole('button', { name: /^(Start|Stop)$/ });
  const reset = page.getByRole('button', { name: 'Reset' });

  await expect(time).toHaveText('00:00.00');
  await expect(time).not.toHaveClass(/running/);
  await expect(reset).toBeDisabled();

  await toggle.click();
  await expect(toggle).toHaveText('Stop');
  await expect(time).toHaveClass(/running/);
  await expect(reset).toBeEnabled();

  await page.clock.runFor(1230);
  await expect(time).toHaveText('00:01.23');

  await toggle.click();
  await expect(toggle).toHaveText('Start');
  await expect(time).not.toHaveClass(/running/);
  await page.clock.runFor(500);
  await expect(time).toHaveText('00:01.23');
  await expect(reset).toBeEnabled();

  await toggle.click();
  await page.clock.runFor(2000);
  await expect(time).toHaveText('00:03.23');

  await reset.click();
  await expect(time).toHaveText('00:00.00');
  await expect(toggle).toHaveText('Start');
  await expect(time).not.toHaveClass(/running/);
  await expect(reset).toBeDisabled();
  await page.clock.runFor(300);
  await expect(time).toHaveText('00:00.00');
});
