import { expect, test } from '../../../e2e';

test('will suspend the profile and count followers in place', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('instructions/set-factory');
  const pending = page.locator('.pending');
  const card = page.locator('.card');

  await expect(pending).toHaveText(['loading profile…', 'counting followers…']);
  await expect(card).toHaveCount(0);

  await page.clock.runFor(1100);
  await expect(card.getByRole('heading')).toHaveText('Welcome back, Ada');
  await expect(card.locator('small')).toHaveText('Engineer');
  await expect(pending).toHaveText(['counting followers…']);

  await page.clock.runFor(800);
  await expect(pending).toHaveText(['1,204 followers']);
  await expect(card.getByRole('heading')).toHaveText('Welcome back, Ada');
});
