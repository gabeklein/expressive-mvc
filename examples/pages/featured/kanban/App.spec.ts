import { expect, test } from '../../../e2e';

test('will add, rename, reorder, move and remove cards', async ({ page, open }) => {
  await open('featured/kanban');
  const column = (label: string) =>
    page.locator('section.column').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
  const titles = (label: string) => column(label).locator('li.card span');
  const count = (label: string) => column(label).locator('.count');
  const card = (title: string) => page.locator('li.card').filter({ hasText: title });

  await expect(page.locator('section.column h2')).toHaveText(['To Do', 'In Progress', 'In Review', 'Done']);
  await expect(column('To Do')).toHaveCSS('--accent', '#6366f1');
  await expect(titles('To Do')).toHaveText(['Write the migration guide']);
  await expect(titles('In Progress')).toHaveText(['Wire drag and drop']);
  await expect(titles('In Review')).toHaveText(['Router guards']);
  await expect(titles('Done')).toHaveText(['Ship map + has', 'Retire hot (#263)']);
  await expect(count('Done')).toHaveText('2');
  await expect(card('Router guards')).toHaveAttribute('draggable', 'true');

  const draft = column('To Do').getByPlaceholder('+ Add a card');
  await draft.fill('Plan release');
  await draft.press('Enter');
  await expect(titles('To Do')).toHaveText(['Write the migration guide', 'Plan release']);
  await expect(count('To Do')).toHaveText('2');
  await expect(draft).toHaveValue('');

  await draft.press('Enter');
  await expect(count('To Do')).toHaveText('2');

  await card('Retire hot (#263)').dragTo(card('Ship map + has'));
  await expect(titles('Done')).toHaveText(['Retire hot (#263)', 'Ship map + has']);
  await expect(page.locator('li.card.dragging, li.card.over')).toHaveCount(0);

  await card('Wire drag and drop').dragTo(column('To Do').locator('form'));
  await expect(titles('To Do')).toHaveText(['Write the migration guide', 'Plan release', 'Wire drag and drop']);
  await expect(titles('In Progress')).toHaveText([]);
  await expect(count('In Progress')).toHaveText('0');
  await expect(count('To Do')).toHaveText('3');
  await expect(column('To Do')).toHaveClass('column');
  await expect(card('Wire drag and drop')).toHaveClass('card');

  await card('Router guards').dragTo(card('Write the migration guide'));
  await expect(titles('To Do')).toHaveText(['Router guards', 'Write the migration guide', 'Plan release', 'Wire drag and drop']);
  await expect(titles('In Review')).toHaveText([]);

  await card('Wire drag and drop').dragTo(card('Plan release'));
  await expect(titles('To Do')).toHaveText(['Router guards', 'Write the migration guide', 'Wire drag and drop', 'Plan release']);

  await card('Plan release').locator('span').dblclick();
  let input = page.locator('li.card input');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Plan release');
  await expect(page.locator('li.card:has(input)')).toHaveAttribute('draggable', 'false');
  await input.fill('Plan the release');
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(titles('To Do')).toHaveText(['Router guards', 'Write the migration guide', 'Wire drag and drop', 'Plan the release']);

  await card('Plan the release').locator('span').dblclick();
  await expect(input).toBeFocused();
  await input.fill('discarded');
  await input.press('Escape');
  await expect(input).toHaveCount(0);
  await expect(titles('To Do').last()).toHaveText('Plan the release');

  await card('Router guards').locator('span').dblclick();
  await expect(input).toBeFocused();
  await input.fill('  ');
  await page.getByRole('heading', { name: 'Kanban' }).click();
  await expect(input).toHaveCount(0);
  await expect(titles('To Do').first()).toHaveText('Router guards');

  await card('Router guards').getByRole('button', { name: 'delete' }).click();
  await expect(titles('To Do')).toHaveText(['Write the migration guide', 'Wire drag and drop', 'Plan the release']);
  await expect(count('To Do')).toHaveText('3');
});
