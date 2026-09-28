import { expect, test } from '../../../e2e';

test('will select people and cycle status', async ({ page, open }) => {
  await open('instructions/map');
  const people = page.locator('ul.people > li');
  const person = (name: string) => people.filter({ hasText: name });
  const dot = (name: string) => person(name).locator('.dot');
  const selected = page.locator('ul.people > li.selected .name');
  const detail = page.locator('aside.detail');
  const heading = detail.getByRole('heading');
  const status = detail.locator('.status');
  const bigDot = detail.locator('.dot');
  const cycle = page.getByRole('button', { name: 'Cycle status' });

  await expect(people.locator('.name')).toHaveText(['Alice', 'Bob', 'Carol', 'Dave']);
  await expect(people).toHaveClass(['person selected', 'person', 'person', 'person']);
  await expect(people.locator('.dot')).toHaveClass(Array(4).fill('dot online'));
  await expect(heading).toHaveText('Alice');
  await expect(status).toHaveText('online');
  await expect(bigDot).toHaveClass('dot lg online');

  await person('Bob').locator('.name').click();
  await expect(selected).toHaveText(['Bob']);
  await expect(heading).toHaveText('Bob');

  await dot('Carol').click();
  await expect(dot('Carol')).toHaveClass('dot away');
  await expect(selected).toHaveText(['Bob']);
  await expect(heading).toHaveText('Bob');
  await expect(status).toHaveText('online');

  await cycle.click();
  await expect(dot('Bob')).toHaveClass('dot away');
  await expect(status).toHaveText('away');
  await expect(bigDot).toHaveClass('dot lg away');

  await cycle.click();
  await expect(dot('Bob')).toHaveClass('dot busy');
  await expect(status).toHaveText('busy');

  await cycle.click();
  await expect(dot('Bob')).toHaveClass('dot online');
  await expect(bigDot).toHaveClass('dot lg online');

  await person('Carol').locator('.name').click();
  await expect(selected).toHaveText(['Carol']);
  await expect(heading).toHaveText('Carol');
  await expect(status).toHaveText('away');
  await expect(bigDot).toHaveClass('dot lg away');

  await dot('Carol').click();
  await expect(dot('Carol')).toHaveClass('dot busy');
  await expect(status).toHaveText('busy');
  await expect(dot('Alice')).toHaveClass('dot online');
});
