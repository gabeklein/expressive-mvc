import { expect, test } from '../../../e2e';

test('will render a menu from the route tree and mark the active tab', async ({ page, open }) => {
  await open('router/nav');
  const view = page.locator('.view');
  const tabs = page.locator('.menu a');
  const tab = (name: string) => page.getByRole('link', { name });
  const expectTabs = (...classes: string[]) =>
    expect(tabs).toHaveClass(classes.map((c) => new RegExp(`^${c}$`)));

  await expect(page.locator('.group h4')).toHaveText(['Guides', 'Reference']);
  await expect(tabs).toHaveText(['Home', 'Getting started', 'Deploying', 'API']);
  await expectTabs('tab here', 'tab', 'tab', 'tab');
  await expect(tab('Getting started')).toHaveAttribute('href', '/guides/start');
  await expect(view).toHaveText('Pick anything in the menu.');

  await tab('Getting started').click();
  await expect(view).toHaveText('Getting started/guides/start');
  await expectTabs('tab near', 'tab here', 'tab', 'tab');

  await expect(tab('API')).toHaveAttribute('href', '/reference/api');
  await tab('API').click();
  await expect(view).toHaveText('API/reference/api');
  await expectTabs('tab near', 'tab', 'tab', 'tab here');

  await tab('Home').click();
  await expect(view).toHaveText('Pick anything in the menu.');
  await expectTabs('tab here', 'tab', 'tab', 'tab');
});
