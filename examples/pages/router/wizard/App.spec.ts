import { expect, test } from '../../../e2e';

test('will gate steps with guards and complete the application', async ({ page, open }) => {
  await open('router/wizard');
  const steps = page.locator('.steps button');
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const name = page.getByPlaceholder('Ada Lovelace');
  const email = page.getByPlaceholder('ada@analytical.engine');
  const card = page.locator('.card');
  const expectSteps = (...classes: string[]) =>
    expect(steps).toHaveClass(classes.map((c) => new RegExp(`^${c}$`)));

  await expect(steps).toHaveText(['1 Name', '2 Details', '3 Review']);
  await expectSteps('step here', 'step', 'step');
  await expect(button('Back')).toBeDisabled();
  await expect(name).toHaveValue('');

  await button('Continue').click();
  await expectSteps('step here', 'step', 'step');
  await expect(name).toBeVisible();

  await button('3 Review').click();
  await expectSteps('step here', 'step', 'step');

  await name.fill('Ada');
  await button('Continue').click();
  await expectSteps('step past', 'step here', 'step');
  await expect(button('Back')).toBeEnabled();

  await button('3 Review').click();
  await expectSteps('step past', 'step here', 'step');

  await button('Back').click();
  await expect(name).toHaveValue('Ada');
  await button('Continue').click();

  await email.fill('ada@example.com');
  await button('Continue').click();
  await expectSteps('step past', 'step past', 'step here');
  await expect(card.locator('dd')).toHaveText(['Ada', 'ada@example.com']);
  await expect(button('Submit')).toBeDisabled();

  const agree = page.getByRole('checkbox', { name: 'Everything above is correct.' });
  await agree.check();
  await expect(button('Submit')).toBeEnabled();

  await button('Submit').click();
  await expect(card).toHaveText('Application received. Thanks, Ada!Start over');
  await expectSteps('step past', 'step past', 'step past');

  await button('Start over').click();
  await expectSteps('step here', 'step', 'step');
  await expect(name).toHaveValue('');

  await button('2 Details').click();
  await expectSteps('step here', 'step', 'step');
});
