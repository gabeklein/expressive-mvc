import { expect, test } from '../../../e2e';

test('will find the form upstream and lock its fields', async ({ page, open }) => {
  await open('instructions/get');
  const fields = page.locator('label.field');
  const inputs = fields.locator('input');
  const [name, email, nickname] = [inputs.nth(0), inputs.nth(1), inputs.nth(2)];

  await expect(fields.locator('span')).toHaveText([
    'Namein a form',
    'Emailin a form',
    'Nicknameno form above'
  ]);
  await expect(page.locator('fieldset.group legend')).toHaveText('Contact');
  await expect(page.locator('fieldset.group label.field')).toHaveCount(1);
  await expect(name).toHaveAttribute('placeholder', 'Your name');
  await expect(email).toHaveAttribute('placeholder', 'Your email');
  await expect(nickname).toHaveAttribute('placeholder', 'Your nickname');
  for (const input of [name, email, nickname]) await expect(input).toBeEnabled();

  await name.fill('Ada');
  await expect(name).toHaveValue('Ada');
  await nickname.fill('ace');
  await expect(nickname).toHaveValue('ace');

  const toggle = page.getByRole('button', { name: 'Lock form' });
  await toggle.click();
  await expect(toggle).toHaveText('Unlock form');
  await expect(name).toBeDisabled();
  await expect(email).toBeDisabled();
  await expect(nickname).toBeEnabled();
  await expect(name).toHaveAttribute('placeholder', 'locked');
  await expect(email).toHaveAttribute('placeholder', 'locked');
  await expect(nickname).toHaveAttribute('placeholder', 'Your nickname');
  await expect(name).toHaveValue('Ada');

  await toggle.click();
  await expect(toggle).toHaveText('Lock form');
  for (const input of [name, email, nickname]) await expect(input).toBeEnabled();
  await expect(name).toHaveAttribute('placeholder', 'Your name');
  await expect(email).toHaveAttribute('placeholder', 'Your email');
});
