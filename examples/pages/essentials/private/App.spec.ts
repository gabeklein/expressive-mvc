import { expect, test } from '../../../e2e';

test('will sign in, load notes with the private token, and sign out', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('essentials/private');
  const name = page.getByRole('textbox', { name: 'Name' });
  const signIn = page.getByRole('button', { name: 'Sign in' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private fields');
  await expect(name).toHaveValue('Ada');

  await name.fill('');
  await expect(signIn).toBeDisabled();

  await name.fill('Grace');
  await signIn.click();
  await expect(signIn).toBeDisabled();

  await page.clock.runFor(300);
  await expect(page.getByText('Signed in as Grace')).toBeVisible();

  const load = page.getByRole('button', { name: 'Load notes' });

  await load.click();
  await expect(load).toBeDisabled();

  await page.clock.runFor(300);
  await expect(page.getByRole('listitem')).toHaveText([
    'Welcome back, Grace.',
    'Your token never left the Session class.'
  ]);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(signIn).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(0);
});
