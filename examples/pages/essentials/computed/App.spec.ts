import { expect, test } from '../../../e2e';

test('will recompute tip and total from bill and percent', async ({ page, open }) => {
  await open('essentials/computed');
  const bill = page.getByRole('spinbutton');
  const percent = page.getByRole('slider');
  const result = page.locator('.result');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Computed');
  await expect(bill).toHaveValue('50');
  await expect(percent).toHaveValue('18');
  await expect(page.getByText('Tip: 18%')).toBeVisible();
  await expect(result).toHaveText('Tip $9.00 · Total $59.00');

  await bill.fill('120');
  await expect(result).toHaveText('Tip $21.60 · Total $141.60');

  await percent.fill('25');
  await expect(page.getByText('Tip: 25%')).toBeVisible();
  await expect(result).toHaveText('Tip $30.00 · Total $150.00');

  await percent.fill('0');
  await expect(page.getByText('Tip: 0%')).toBeVisible();
  await expect(result).toHaveText('Tip $0.00 · Total $120.00');

  await bill.fill('33.5');
  await expect(result).toHaveText('Tip $0.00 · Total $33.50');

  await percent.fill('10');
  await expect(result).toHaveText('Tip $3.35 · Total $36.85');
});
