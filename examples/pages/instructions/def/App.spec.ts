import { expect, test } from '../../../e2e';

test('will clamp volume and slugify handle', async ({ page, open }) => {
  await open('instructions/def');
  const volume = page.locator('output');
  const minus = page.getByText('−3');
  const plus = page.getByText('+3');

  await expect(volume).toHaveText('5');
  await minus.click();
  await expect(volume).toHaveText('2');
  await minus.click();
  await expect(volume).toHaveText('0');
  await plus.click();
  await expect(volume).toHaveText('3');
  await plus.click();
  await plus.click();
  await plus.click();
  await expect(volume).toHaveText('10');

  const handle = page.getByPlaceholder('Type A Name');
  await expect(handle).toHaveValue('');
  await handle.fill('Hello World');
  await expect(handle).toHaveValue('hello-world');
  await handle.fill('hello-world!!Foo');
  await expect(handle).toHaveValue('hello-world-foo');
});
