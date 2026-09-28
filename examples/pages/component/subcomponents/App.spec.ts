import { expect, test } from '../../../e2e';

test('will select through overridden Item and Summary seams', async ({ page, open }) => {
  await open('component/subcomponents');
  const fruit = page.locator('.picker').nth(0);
  const color = page.locator('.picker').nth(1);
  const summary = (picker: typeof fruit) => picker.locator(':scope > small');

  await expect(fruit).toHaveClass('pane picker fruit');
  await expect(color).toHaveClass('pane picker palette');
  await expect(fruit.getByRole('heading')).toHaveText('Choose Fruit');
  await expect(color.getByRole('heading')).toHaveText('Choose Color');
  await expect(fruit.locator('li')).toHaveText(['🍎 Apple', '🍏 Banana', '🍏 Cherry']);
  await expect(fruit.locator('li.active')).toHaveText('🍎 Apple');
  await expect(summary(fruit)).toHaveText('Selected: Apple');

  const swatches = color.locator('.swatch');
  await expect(swatches.nth(0)).toHaveCSS('background-color', 'rgb(255, 111, 97)');
  await expect(swatches.nth(1)).toHaveCSS('background-color', 'rgb(77, 171, 247)');
  await expect(swatches.nth(2)).toHaveCSS('background-color', 'rgb(81, 207, 102)');
  await expect(summary(color)).toHaveText('Coral #ff6f61');

  await fruit.getByText('Banana').click();
  await expect(fruit.locator('li')).toHaveText(['🍏 Apple', '🍎 Banana', '🍏 Cherry']);
  await expect(fruit.locator('li.active')).toHaveText('🍎 Banana');
  await expect(summary(fruit)).toHaveText('Selected: Banana');
  await expect(summary(color)).toHaveText('Coral #ff6f61');

  await swatches.nth(2).click();
  await expect(color.locator('li').nth(2)).toHaveClass('active');
  await expect(color.locator('li.active')).toHaveCount(1);
  await expect(summary(color).locator('code')).toHaveText('#51cf66');
  await expect(summary(color)).toHaveText('Mint #51cf66');

  await fruit.getByText('Cherry').click();
  await expect(summary(fruit)).toHaveText('Selected: Cherry');
  await expect(color.locator('li').nth(2)).toHaveClass('active');
});
