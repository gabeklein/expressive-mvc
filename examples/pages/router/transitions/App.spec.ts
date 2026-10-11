import { expect, test } from '../../../e2e';

test('will hold the screen when deferred and flash the fallback when urgent', async ({ page, open }) => {
  await page.clock.install();
  await open('router/transitions');
  const address = page.locator('.address');
  const view = page.locator('.view');
  const bar = page.locator('.bar');
  const box = page.getByRole('checkbox', { name: /hold the screen/ });

  const hold = async (heading: string, path: string) => {
    for (let t = 0; t < 600; t += 100) {
      await page.clock.runFor(100);
      const sample = await page.evaluate(() => ({
        address: document.querySelector('.address')!.textContent,
        heading: document.querySelector('.view h2')?.textContent,
        busy: document.querySelector('.bar')!.hasAttribute('data-busy')
      }));
      expect(sample, `held at ${t + 100}ms`).toEqual({ address: `museum.example${path}`, heading, busy: true });
    }
  };

  await expect(address).toHaveText('museum.example/');
  await expect(view).toHaveText('FoyerPick a wing. Each one is behind a slow door.');
  await expect(bar).not.toHaveAttribute('data-busy');
  await expect(box).toBeChecked();

  await page.getByRole('link', { name: 'Paintings' }).click();
  await hold('Foyer', '/');
  await page.clock.runFor(200);
  await expect(address).toHaveText('museum.example/paintings');
  await expect(view).toHaveText('PaintingsThe paintings wing, fully loaded.');
  await expect(view.locator('section')).toHaveClass('room rose');
  await expect(bar).not.toHaveAttribute('data-busy');

  await box.uncheck();
  await expect(box).not.toBeChecked();

  await page.getByRole('link', { name: 'Sculpture' }).click();
  await page.clock.runFor(100);
  await expect(address).toHaveText('museum.example/sculpture');
  await expect(view).toHaveText('unlocking…');
  await expect(view.locator('p')).toHaveClass('gate');
  await page.clock.runFor(700);
  await expect(view).toHaveText('SculptureThe sculpture wing, fully loaded.');
  await expect(view.locator('section')).toHaveClass('room gold');
  await expect(bar).not.toHaveAttribute('data-busy');

  await box.check();
  await expect(box).toBeChecked();

  await page.getByRole('link', { name: 'Archives' }).click();
  await hold('Sculpture', '/sculpture');
  await page.clock.runFor(200);
  await expect(address).toHaveText('museum.example/archives');
  await expect(view).toHaveText('ArchivesThe archives wing, fully loaded.');
  await expect(view.locator('section')).toHaveClass('room teal');
});
