import { expect, test } from '../../../e2e';

test('will redirect, admit, hold, and cede to none', async ({ page, open }) => {
  await page.clock.install();
  await open('router/guards');
  const view = page.locator('.view');
  const follow = async (name: string, href: string) => {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', href);
    await link.click();
  };
  const hold = async (text: string) => {
    for (let t = 0; t < 500; t += 100) {
      await page.clock.runFor(100);
      const sample = await page.evaluate(() => document.querySelector('.view')!.textContent!.replace(/\s+/g, ' '));
      expect(sample, `held at ${t + 100}ms`).toBe(text);
    }
  };

  await expect(view).toHaveText('Signed out - Sign in');

  await follow('Charter', '/vault/charter');
  await expect(view).toHaveText('The guard sent you here. Sign in from the lobby, then try the vault again.');

  await follow('Secrets', '/vault/secrets');
  await expect(view).toHaveText(/^The guard sent you here/);

  await follow('Lobby', '/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(view).toHaveText('Signed in as Ada - Sign out');

  await follow('Charter', '/vault/charter');
  await hold('Signed in as Ada - Sign out');
  await page.clock.runFor(200);
  await expect(view).toHaveText('Reading charter');
  await expect(view.locator('p')).toHaveClass('doc');

  await follow('Secrets', '/vault/secrets');
  await hold('Reading charter');
  await page.clock.runFor(200);
  await expect(view).toHaveText('No such document in the vault.');

  await follow('Outside vault', '/missing');
  await expect(view).toHaveText('No application page matches this URL.');

  await follow('Lobby', '/');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(view).toHaveText('Signed out - Sign in');
});
