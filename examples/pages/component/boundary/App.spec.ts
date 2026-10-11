import type { Page } from '@playwright/test';

import { expect, test } from '../../../e2e';

const RECOVERED = 'The widget failed to render.';
const ESCALATED = 'The widget gave up.';

// React dev logs every error a boundary catches through console.error; dom logs nothing.
// The fixture fails on any console.error, so swap its console listener for one that
// ignores exactly those two thrown demo errors and still fails on anything else.
async function setup(page: Page, open: (path: string) => Promise<void>) {
  const unexpected: string[] = [];

  await open('component/boundary');
  page.removeAllListeners('console');
  page.on('console', (message) => {
    const text = message.text();

    if (message.type() != 'error' || text.startsWith('Failed to load resource')) return;
    if (text.includes(`Error: ${RECOVERED}`) || text.includes(`Error: ${ESCALATED}`)) return;

    unexpected.push(text);
  });

  const cards = page.locator('.card');

  return {
    cards,
    outer: page.locator('.container > .error'),
    breakIt: (i: number) => cards.nth(i).getByRole('button', { name: 'Break it' }).click(),
    done: () => expect(unexpected, 'unexpected console.error').toEqual([])
  };
}

test('will recover in place', async ({ page, open }) => {
  const { cards, outer, breakIt, done } = await setup(page, open);

  await expect(cards).toHaveText(['Handled in placeBreak it', 'EscalatedBreak it']);

  await breakIt(0);
  await expect(cards.nth(0)).toHaveText(`Handled in placeCaught right here: ${RECOVERED}Retry`);
  await expect(cards.nth(0).getByRole('button', { name: 'Retry' })).toHaveClass('button');
  await expect(cards.nth(1)).toHaveText('EscalatedBreak it');
  await expect(outer).toHaveCount(0);

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(cards.nth(0)).toHaveText('Handled in placeBreak it');
  await expect(cards.nth(0).locator('.error')).toHaveCount(0);

  await breakIt(0);
  await expect(cards.nth(0)).toHaveText(`Handled in placeCaught right here: ${RECOVERED}Retry`);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(cards.nth(0)).toHaveText('Handled in placeBreak it');

  done();
});

test('will escalate to the boundary and start over', async ({ page, open }) => {
  const { cards, outer, breakIt, done } = await setup(page, open);

  await breakIt(1);
  await expect(cards).toHaveCount(0);
  await expect(outer).toHaveText(`Reached the boundary: ${ESCALATED}Start over`);
  await expect(outer.getByRole('button')).toHaveClass('button primary');
  await expect(page.locator('.container > small')).toContainText('The first card keeps its error');

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(outer).toHaveCount(0);
  await expect(cards).toHaveText(['Handled in placeBreak it', 'EscalatedBreak it']);

  await breakIt(1);
  await expect(outer).toHaveText(`Reached the boundary: ${ESCALATED}Start over`);
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(cards.nth(1)).toHaveText('EscalatedBreak it');

  done();
});

test('will rebuild an inner fallback under an outer one', async ({ page, open, host }) => {
  const { cards, outer, breakIt, done } = await setup(page, open);

  await breakIt(0);
  await expect(cards.nth(0)).toHaveText(`Handled in placeCaught right here: ${RECOVERED}Retry`);
  await breakIt(1);
  await expect(cards).toHaveCount(0);
  await expect(outer).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveText(
    host == 'react' ? 'Handled in placeBreak it' : `Handled in placeCaught right here: ${RECOVERED}Retry`
  );
  await expect(cards.nth(1)).toHaveText('EscalatedBreak it');

  done();
});
