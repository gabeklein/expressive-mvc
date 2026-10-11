import { expect, test } from '../../../e2e';

test('will filter and sort via query and walk back through it', async ({ page, open }) => {
  await open('router/query');
  const start = page.url();
  const url = page.locator('footer code');
  const titles = page.locator('.books li');
  const click = (name: string) => page.getByRole('button', { name }).click();
  const all = ['Analysis I', 'Concrete Mathematics', 'Structure and Interpretation'];

  await expect(url).toHaveText('/');
  await expect(titles).toHaveText(all.map((t) => new RegExp(`^${t}`)));

  await click('Sort year');
  await expect(url).toHaveText('/?sort=year');
  await expect(titles).toHaveText([...all].reverse().map((t) => new RegExp(`^${t}`)));

  await click('Only math');
  await expect(url).toHaveText('/?sort=year&tag=math');
  await expect(titles).toHaveText([/^Concrete Mathematics/, /^Analysis I/]);

  await click('Clear tag');
  await expect(url).toHaveText('/?sort=year');
  await expect(titles).toHaveCount(3);

  await click('Back');
  await expect(url).toHaveText('/?sort=year&tag=math');
  await expect(titles).toHaveText([/^Concrete Mathematics/, /^Analysis I/]);

  await click('Back');
  await expect(url).toHaveText('/?sort=year');
  await expect(titles).toHaveCount(3);

  await click('Sort title');
  await expect(url).toHaveText('/?sort=title');
  await expect(titles).toHaveText(all.map((t) => new RegExp(`^${t}`)));

  expect(page.url()).toBe(start);
});
