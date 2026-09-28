import type { Page } from '@playwright/test';
import { expect, test } from '../../../e2e';

const random = (page: Page, value: number) =>
  page.addInitScript((value) => { Math.random = () => value; }, value);

test('will count down and replace an agent', async ({ page, open }) => {
  await page.clock.install();
  await page.route('https://randomuser.me/api?nat=gb&results=1', (route) =>
    route.fulfill({ json: { results: [{ name: { last: 'Smith' } }] } }));
  await open('essentials/async');
  const seconds = page.locator('.seconds');

  await expect(page.getByRole('heading', { name: 'Async Example' })).toBeVisible();
  await expect(page.getByText('Agent Bond')).toBeVisible();
  await expect(seconds).toHaveText('30');

  await page.clock.runFor(1000);
  await expect(seconds).toHaveText('29');

  await page.clock.runFor(3000);
  await expect(seconds).toHaveText('26');

  await page.getByRole('button', { name: 'Tap another agent' }).click();
  await expect(page.getByText('Agent Smith')).toBeVisible();
  await expect(seconds).toHaveText('26');
});

test('will explode the cat when time runs out', async ({ page, open }) => {
  await random(page, 0.9);
  await page.clock.install();
  await open('essentials/async');

  await page.clock.runFor(29000);
  await expect(page.locator('.seconds')).toHaveText('1');

  await page.clock.runFor(1000);
  await expect(page.locator('.emoji')).toHaveText('🙀💥');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Unfortunately, the cat exploded.');
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('will spare the cat when time runs out', async ({ page, open }) => {
  await random(page, 0.1);
  await page.clock.install();
  await open('essentials/async');

  await page.clock.runFor(30000);
  await expect(page.locator('.emoji')).toHaveText('😸👍');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Oh, the cat did not explode.');
});
