import { expect, test } from '../../../e2e';

test('will swap instances in place and keep their state', async ({ page, open }) => {
  await open('component/injection');
  const slot = page.locator('.slot');
  const tab = (name: string) => page.getByRole('button', { name, exact: true });
  const area = slot.getByRole('textbox');
  const head = slot.locator('header');

  await expect(tab('Draft')).toHaveClass('button primary');
  await expect(tab('Review')).toHaveClass('button');
  await expect(head).toHaveText('Draft0 words');
  await expect(area).toHaveAttribute('placeholder', 'Write the draft…');

  await area.fill('hello brave world');
  await expect(head).toHaveText('Draft3 words');

  await tab('Review').click();
  await expect(tab('Review')).toHaveClass('button primary');
  await expect(tab('Draft')).toHaveClass('button');
  await expect(slot.locator('.panel')).toHaveCount(1);
  await expect(head).toHaveText('Review0 words');
  await expect(area).toHaveValue('');
  await expect(area).toHaveAttribute('placeholder', 'Write the review…');

  await area.pressSequentially('lgtm');
  await expect(head).toHaveText('Review1 words');

  await tab('Draft').click();
  await expect(head).toHaveText('Draft3 words');
  await expect(area).toHaveValue('hello brave world');

  await tab('Close').click();
  await expect(slot).toBeEmpty();
  await expect(tab('Draft')).toHaveClass('button');
  await expect(tab('Review')).toHaveClass('button');

  await tab('Review').click();
  await expect(head).toHaveText('Review1 words');
  await expect(area).toHaveValue('lgtm');

  await area.fill('   ');
  await expect(head).toHaveText('Review0 words');
});
