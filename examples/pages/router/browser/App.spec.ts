import { expect, test } from '../../../e2e';

test('will follow links, persist layout, and walk history', async ({ page, open }) => {
  await open('router/browser');
  await page.evaluate(() => ((window as any).loaded = true));
  const address = page.locator('.address');
  const view = page.locator('.view');
  const layout = page.locator('.project');

  const at = async (path: string, text: string) => {
    await expect(page).toHaveURL((url) => url.pathname + url.search == path);
    await expect(address).toHaveText(path);
    await expect(view).toHaveText(text);
    expect(await page.evaluate(() => (window as any).loaded)).toBe(true);
  };

  const follow = async (name: string, href: string, text: string) => {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await link.click();
    await at(href, text);
  };

  await at('/', 'Choose a destination.');

  await follow('Projects', '/projects', 'ProjectsSelect a project.');
  await layout.evaluate((el) => ((el as any).kept = true));

  await follow('Ada', '/projects/ada', 'ProjectsProject: ada');
  expect(await layout.evaluate((el) => (el as any).kept)).toBe(true);

  await follow('Section miss', '/projects/ada/files', 'ProjectsNo project page matches this URL.');
  expect(await layout.evaluate((el) => (el as any).kept)).toBe(true);

  await follow('App miss', '/elsewhere', 'No application page matches this URL.');

  await page.goBack();
  await at('/projects/ada/files', 'ProjectsNo project page matches this URL.');

  await page.goBack();
  await at('/projects/ada', 'ProjectsProject: ada');

  await page.goForward();
  await at('/projects/ada/files', 'ProjectsNo project page matches this URL.');

  await follow('Home', '/', 'Choose a destination.');
});
