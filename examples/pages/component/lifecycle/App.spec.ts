import { expect, test } from '../../../e2e';

const MOUNTED = ['new() · constructed', 'ref() · element attached', 'mount() · committed'];
const UNMOUNTED = ['ref() · element detached', 'mount() cleanup · unmounted', 'new() cleanup · destroyed'];

test('will fire each seam and unwind on unmount', async ({ page, open }) => {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.setViewportSize({ width: 800, height: 600 });
  await open('component/lifecycle');
  const trace = page.locator('.trace li');
  const probe = page.locator('.probe');
  const toggle = page.getByRole('button', { name: /^(Unmount|Mount)$/ });

  await expect(trace).toHaveText(MOUNTED);
  await expect(probe.locator('strong')).toHaveText('800px');
  await expect(probe.locator('small')).toHaveText('alive 0s');
  await expect(toggle).toHaveText('Unmount');

  await page.setViewportSize({ width: 640, height: 600 });
  await expect(probe.locator('strong')).toHaveText('640px');

  await page.clock.runFor(1050);
  await expect(probe.locator('small')).toHaveText('alive 1s');

  await toggle.click();
  await expect(probe).toHaveCount(0);
  await expect(toggle).toHaveText('Mount');
  await expect(trace).toHaveText([...MOUNTED, ...UNMOUNTED]);

  await page.setViewportSize({ width: 720, height: 600 });
  await page.clock.runFor(1050);
  await expect(trace).toHaveCount(6);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(trace).toHaveCount(0);

  await toggle.click();
  await expect(trace).toHaveText(MOUNTED);
  await expect(probe.locator('strong')).toHaveText('720px');
  await expect(probe.locator('small')).toHaveText('alive 0s');

  await toggle.click();
  await expect(trace).toHaveText([...MOUNTED, ...UNMOUNTED]);
});
