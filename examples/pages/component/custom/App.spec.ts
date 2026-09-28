import { expect, test } from '../../../e2e';

test('will keep arc, slider and input in step', async ({ page, open }) => {
  await open('component/custom');
  const arc = page.locator('svg[role=slider]');
  const range = page.locator('input[type=range]');
  const digits = page.getByRole('spinbutton');
  const well = page.locator('.well');
  const footer = page.locator('form footer small');
  const knob = arc.locator('circle.knob');

  const shows = async (value: number, numeral: string) => {
    await expect(arc).toHaveAttribute('aria-valuenow', String(value));
    await expect(range).toHaveValue(String(value));
    await expect(digits).toHaveValue(String(value));
    await expect(well).toHaveText(numeral);
    await expect(footer).toHaveText(`Manuscript, Volume ${numeral}`);
  };

  await expect(arc).toHaveAttribute('aria-valuemin', '1');
  await expect(arc).toHaveAttribute('aria-valuemax', '100');
  await shows(14, 'XIV');

  await arc.focus();
  await page.keyboard.press('ArrowRight');
  await shows(15, 'XV');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await shows(14, 'XIV');
  await page.keyboard.press('a');
  await shows(14, 'XIV');

  await digits.fill('49');
  await shows(49, 'XLIX');

  await range.fill('88');
  await shows(88, 'LXXXVIII');

  await digits.fill('150');
  await shows(100, 'C');

  await digits.fill('0');
  await shows(1, 'I');

  await digits.fill('12.6');
  await shows(13, 'XIII');

  const box = (await arc.boundingBox())!;
  const unit = box.width / 240;
  const at = (x: number, y: number) => [box.x + x * unit, box.y + y * unit] as const;

  await page.mouse.move(...at(120, 24));
  await page.mouse.down();
  await shows(51, 'LI');
  await expect(knob).toHaveAttribute('cy', /^24(\.|$)/);

  await page.mouse.move(...at(220, 124));
  await shows(100, 'C');

  await page.mouse.move(...at(10, 200));
  await shows(1, 'I');

  await page.mouse.up();
  await page.mouse.move(...at(220, 124));
  await shows(1, 'I');
});

test('will not submit the form', async ({ page, open }) => {
  await open('component/custom');
  const url = page.url();

  await page.getByRole('spinbutton').press('Enter');
  await expect(page.locator('svg[role=slider]')).toHaveAttribute('aria-valuenow', '14');
  expect(page.url()).toBe(url);
});
