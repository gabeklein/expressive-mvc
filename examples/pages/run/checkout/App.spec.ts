import type { Page } from '@playwright/test';

import { expect, test } from '../../../e2e';

test.beforeEach(async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('run/checkout');
});

const ids = (page: Page) => page.locator('.record code');

const field = (page: Page, name: string) =>
  page.locator('.fields dt', { hasText: name }).locator('xpath=following-sibling::dd[1]');

async function authorize(page: Page) {
  const status = page.locator('.status');

  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(status).toHaveText('Status: running · reserve');

  await page.clock.runFor(400);
  await expect(status).toHaveText('Status: running · pay');
  await expect(field(page, 'Hold')).toHaveText('H-1');

  await page.clock.runFor(600);
  await expect(status).toHaveText('Status: waiting');
  await expect(field(page, 'Authorization')).toHaveText('A-4242-$60');
}

test('will run the checkout to end once approved', async ({ page }) => {
  const approve = page.getByRole('button', { name: 'Approve' });
  const decline = page.getByRole('button', { name: 'Decline' });
  const place = page.getByRole('button', { name: 'Place order' });

  await expect(page.locator('.status')).toHaveText('Status: idle');
  await expect(approve).toHaveCount(0);

  await authorize(page);
  await expect(place).toHaveCount(0);
  await expect(approve).toBeVisible();
  await expect(decline).toBeVisible();

  await approve.click();
  await expect(approve).toHaveCount(0);
  await expect(decline).toHaveCount(0);
  await expect(page.locator('.status')).toHaveText(/^Status: running/);

  await page.clock.runFor(300);
  await expect(field(page, 'Receipt')).toHaveText('R-A-4242-$60');
  await expect(field(page, 'Tracking')).toHaveText('-');

  await page.clock.runFor(500);
  await expect(field(page, 'Tracking')).toHaveText('T-H-1-1');
  await expect(page.locator('.status')).toHaveText('Status: idle');
  await expect(place).toBeVisible();
  await expect(ids(page)).toHaveText(['next#1', 'reserve#1', 'pay#1', 'approve#1', 'mail#1', 'ship#1', 'end#1']);
});

test('will go back to reserve when the card is declined', async ({ page }) => {
  await authorize(page);
  await page.getByRole('button', { name: 'Decline' }).click();

  await expect(page.locator('.notice')).toHaveText('Card declined.');
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try another card' })).toBeVisible();
  await expect(page.locator('.status')).toHaveText('Status: waiting');
  await expect(field(page, 'Hold')).toHaveText('H-1');
  await expect(field(page, 'Authorization')).toHaveText('-');
  await expect(ids(page)).toHaveText(['next#1', 'reserve#1', 'pay#1', 'decline#1']);
  await expect(page.locator('.record li', { hasText: 'pay#1' })).toContainText('undone');
});

test('will decline an approval nobody answers', async ({ page }) => {
  await authorize(page);
  await page.clock.runFor(15000);

  await expect(page.locator('.notice')).toHaveText('Card timed out.');
  await expect(page.getByRole('button', { name: 'Try another card' })).toBeVisible();
});

test('will retry with another card after a decline', async ({ page }) => {
  await authorize(page);
  await page.getByRole('button', { name: 'Decline' }).click();

  await page.getByRole('textbox').fill('5555 5555 5555 4444');
  await page.getByRole('button', { name: 'Try another card' }).click();
  await expect(page.getByRole('button', { name: 'Try another card' })).toHaveCount(0);
  await expect(page.locator('.status')).toHaveText('Status: running · pay');

  await page.clock.runFor(600);
  await expect(field(page, 'Authorization')).toHaveText('A-4444-$60');
  await expect(page.locator('.notice')).toHaveCount(0);

  await page.getByRole('button', { name: 'Approve' }).click();
  await page.clock.runFor(800);

  await expect(page.locator('.status')).toHaveText('Status: idle');
  await expect(field(page, 'Tracking')).toHaveText('T-H-1-1');
  await expect(ids(page)).toHaveText([
    'next#1', 'reserve#1', 'pay#1', 'decline#1', 'pay#2', 'approve#1', 'mail#1', 'ship#1', 'end#1'
  ]);
});

test('will stop and unwind mid-run', async ({ page }) => {
  await authorize(page);
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.locator('.status')).toHaveText('Status: stopped');
  await expect(page.locator('.notice')).toHaveText('Order cancelled.');
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);
  await expect(field(page, 'Hold')).toHaveText('-');
  await expect(field(page, 'Authorization')).toHaveText('-');

  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.locator('.status')).toHaveText('Status: running · reserve');
  await expect(ids(page)).toHaveText(['next#1']);
});
