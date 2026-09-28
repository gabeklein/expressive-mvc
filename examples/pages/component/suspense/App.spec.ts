import { expect, test } from '../../../e2e';

test('will show each fallback until its value resolves', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('component/suspense');
  const own = page.locator('.card').nth(0);
  const deferred = page.locator('.card').nth(1);

  const pending = async () => {
    await expect(own).toHaveText('Its own boundaryGreeting someone…');
    await expect(deferred).toHaveText('Deferred to an ancestorThe panel is waiting…');
    await expect(own.locator('p.result')).toHaveCount(0);
  };

  await pending();

  await page.clock.runFor(1000);
  await expect(own.locator('p.result')).toHaveText('Hello, Ada.');
  await expect(deferred).toHaveText('Deferred to an ancestorThe panel is waiting…');

  await page.clock.runFor(500);
  await expect(deferred.locator('p.result')).toHaveText('Goodbye, Grace.');
  await expect(deferred).toHaveText('Deferred to an ancestorGoodbye, Grace.');

  await page.getByRole('button', { name: 'Ask again' }).click();
  await pending();

  await page.clock.runFor(1000);
  await expect(own).toHaveText('Its own boundaryHello, Ada.');
  await expect(deferred).toHaveText('Deferred to an ancestorThe panel is waiting…');

  await page.clock.runFor(500);
  await expect(deferred).toHaveText('Deferred to an ancestorGoodbye, Grace.');
});
