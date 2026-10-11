import { expect, test } from '../../../e2e';

test('will autosave after a pause and save on demand', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await open('essentials/unmanaged');
  const draft = page.getByRole('textbox', { name: 'Draft' });
  const status = page.locator('.status');
  const save = page.getByRole('button', { name: 'Save now' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unmanaged fields');
  await expect(status).toHaveText('Nothing to save');
  await expect(save).toBeDisabled();

  await draft.fill('Hello');
  await expect(status).toHaveText('Unsaved changes');
  await expect(save).toBeEnabled();

  await page.clock.runFor(400);
  await draft.fill('Hello there');
  await page.clock.runFor(400);
  await expect(status).toHaveText('Unsaved changes');

  await page.clock.runFor(250);
  await expect(status).toHaveText('Saved');
  await expect(save).toBeDisabled();

  await draft.fill('Hello again');
  await save.click();
  await expect(status).toHaveText('Saved');

  const delay = page.getByRole('slider');

  await draft.fill('Hello, slider');
  await page.clock.runFor(300);
  await delay.fill('2000');
  await expect(page.getByText('Delay: 2000ms')).toBeVisible();
  await page.clock.runFor(350);
  await expect(status).toHaveText('Saved');

  await draft.fill('Hello, slow save');
  await page.clock.runFor(1000);
  await expect(status).toHaveText('Unsaved changes');
  await page.clock.runFor(1050);
  await expect(status).toHaveText('Saved');
});
