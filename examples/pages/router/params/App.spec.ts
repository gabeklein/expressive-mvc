import { expect, test } from '../../../e2e';

test('will swap params in place and remount on re-entry', async ({ page, open }) => {
  await open('router/params');
  const view = page.locator('.view');
  const section = page.locator('.section');
  const heading = section.locator('h2');
  const instance = section.locator('small');
  const docs = page.getByRole('link', { name: 'Docs' });

  await expect(view).toHaveText('Pick Docs above to enter a section with a param.');

  await expect(docs).toHaveAttribute('href', '/docs/intro');
  await docs.click();
  await expect(section.locator('header')).toHaveText('docs section');
  await expect(heading).toHaveText('intro');
  const first = Number((await instance.textContent())!.match(/#(\d+)/)![1]);
  await section.evaluate((el) => ((el as any).marker = true));

  await page.getByRole('button', { name: 'install' }).click();
  await expect(heading).toHaveText('install');
  await expect(instance).toHaveText(`page instance #${first}`);
  expect(await section.evaluate((el) => (el as any).marker)).toBe(true);

  await page.getByRole('button', { name: 'api' }).click();
  await expect(heading).toHaveText('api');
  await expect(instance).toHaveText(`page instance #${first}`);

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(view).toHaveText('Pick Docs above to enter a section with a param.');

  await docs.click();
  await expect(heading).toHaveText('intro');
  await expect(instance).toHaveText(`page instance #${first + 1}`);
});
