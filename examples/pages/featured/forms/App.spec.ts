import { expect, test } from '../../../e2e';

test('will bind inputs, preview values and submit', async ({ page, open }) => {
  const alerts: string[] = [];
  page.on('dialog', (dialog) => {
    alerts.push(dialog.message());
    dialog.accept();
  });

  await open('featured/forms');
  const first = page.getByPlaceholder('Firstname');
  const last = page.getByPlaceholder('Lastname');
  const email = page.getByPlaceholder('Email Address');
  const submit = page.getByRole('button', { name: 'Submit' });
  const preview = async () => JSON.parse(await page.locator('pre').textContent() ?? '');

  await expect(page.getByRole('heading')).toHaveText('Example Form');
  await expect(first).toHaveAttribute('name', 'firstname');
  await expect(last).toHaveAttribute('name', 'lastname');
  await expect(email).toHaveAttribute('name', 'email');
  expect(await preview()).toMatchObject({ firstname: '', lastname: '', email: '' });

  await submit.click();
  await expect.poll(() => alerts).toEqual(['Please fill out all fields']);

  await first.fill('Ada');
  await expect.poll(preview).toMatchObject({ firstname: 'Ada', lastname: '', email: '' });

  await last.fill('Lovelace');
  await email.fill('ada@example.com');
  await expect.poll(preview).toMatchObject({ firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' });

  await submit.click();
  await expect.poll(() => alerts).toEqual([
    'Please fill out all fields',
    'Submitting Ada Lovelace with email ada@example.com'
  ]);

  await first.fill('');
  await expect.poll(preview).toMatchObject({ firstname: '' });
  await expect(first).toHaveValue('');
});
