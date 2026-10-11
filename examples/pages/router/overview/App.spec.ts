import { expect, test } from '../../../e2e';

test('will navigate in memory between routes and params', async ({ page, open }) => {
  await open('router/overview');
  const url = page.url();
  const view = page.locator('.view');

  const follow = async (name: string, href: string, text: string) => {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await link.click();
    await expect(view).toHaveText(text);
    expect(page.url()).toBe(url);
  };

  await expect(view).toHaveText('Welcome. Pick a link - navigation is in-memory here.');
  await follow('About', '/about', 'Each view is its own Component, matched by its Route.');
  await follow('New user', '/user/new', 'Create a user.');
  await follow('User', '/user/ada', 'Param name = ada');
  await expect(view.locator('b')).toHaveText('ada');
  await follow('Missing', '/missing', 'No page matches this URL.');
  await follow('Home', '/', 'Welcome. Pick a link - navigation is in-memory here.');
});

test('will not intercept a modified click', async ({ page, open }) => {
  await open('router/overview');
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      (window as any).prevented = event.defaultPrevented;
      event.preventDefault();
    });
  });

  await page.getByRole('link', { name: 'About' }).click({ modifiers: ['ControlOrMeta'] });
  expect(await page.evaluate(() => (window as any).prevented)).toBe(false);
  await expect(page.locator('.view')).toHaveText('Welcome. Pick a link - navigation is in-memory here.');
});
