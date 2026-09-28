import type { Page, Route } from '@playwright/test';
import { expect, test } from '../../../e2e';

const API = 'https://randomuser.me/api?nat=us&results=1';

function hold(page: Page) {
  const held = new Promise<Route>((resolve) => page.route(API, resolve, { times: 1 }));

  return {
    reply: async (first: string, last: string) =>
      (await held).fulfill({ json: { results: [{ name: { first, last } }] } }),
    abort: async () => (await held).abort(),
  };
}

test('will wait, greet and reset', async ({ page, open }) => {
  let request = hold(page);
  await open('essentials/fetch');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fetch Example');

  await page.getByRole('button', { name: 'Say hello to server' }).click();
  await expect(page.getByText('Sent. Waiting on response...')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);

  await request.reply('Ada', 'Lovelace');
  await expect(page.getByText('Server said: Hello Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Sent. Waiting on response...')).toHaveCount(0);

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.fetch-result')).toHaveCount(0);

  request = hold(page);
  await page.getByRole('button', { name: 'Say hello to server' }).click();
  await request.reply('Alan', 'Turing');
  await expect(page.getByText('Server said: Hello Alan Turing')).toBeVisible();
});

test('will show an error and reset', async ({ page, open }) => {
  const request = hold(page);
  await open('essentials/fetch');

  await page.getByRole('button', { name: 'Say hello to server' }).click();
  await expect(page.getByText('Sent. Waiting on response...')).toBeVisible();

  await request.abort();
  await expect(page.getByText('Error: Failed to fetch')).toBeVisible();
  await expect(page.getByText('Sent. Waiting on response...')).toHaveCount(0);

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('button', { name: 'Say hello to server' })).toBeVisible();
  await expect(page.locator('.fetch-result')).toHaveCount(0);
});
