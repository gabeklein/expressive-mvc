import { expect, test } from '../../../e2e';

test('will reapply parent props and keep own seeded state', async ({ page, open }) => {
  await open('component/props');
  const [cpu, disk] = [page.locator('.gauge').nth(0), page.locator('.gauge').nth(1)];
  const preset = (name: string) => page.getByRole('button', { name, exact: true });
  const plus = (gauge: typeof cpu) => gauge.getByRole('button', { name: '+' });
  const minus = (gauge: typeof cpu) => gauge.getByRole('button', { name: '−' });
  const fill = (gauge: typeof cpu, width: string) =>
    expect(gauge.locator('.fill')).toHaveAttribute('style', new RegExp(`width: ${width}`));

  await expect(page.locator('.gauge header span')).toHaveText(['CPU', 'Disk']);
  await expect(cpu.locator('output')).toHaveText('8%');
  await fill(cpu, '8%');
  await expect(disk.locator('output')).toHaveText('128 GB');
  await fill(disk, '25%');
  await expect(preset('idle')).toHaveClass('button primary');
  await expect(preset('busy')).toHaveClass('button');

  await preset('busy').click();
  await expect(cpu.locator('output')).toHaveText('62%');
  await fill(cpu, '62%');
  await expect(preset('busy')).toHaveClass('button primary');
  await expect(preset('idle')).toHaveClass('button');

  await plus(cpu).click();
  await expect(cpu.locator('output')).toHaveText('72%');
  await fill(cpu, '72%');

  await plus(disk).click();
  await plus(disk).click();
  await expect(disk.locator('output')).toHaveText('192 GB');
  await fill(disk, '38%');

  await preset('busy').click();
  await expect(cpu.locator('output')).toHaveText('72%');

  await preset('peak').click();
  await expect(cpu.locator('output')).toHaveText('97%');
  await plus(cpu).click();
  await expect(cpu.locator('output')).toHaveText('100%');
  await expect(disk.locator('output')).toHaveText('192 GB');

  await preset('idle').click();
  await expect(cpu.locator('output')).toHaveText('8%');
  await minus(cpu).click();
  await expect(cpu.locator('output')).toHaveText('0%');
  await expect(disk.locator('output')).toHaveText('192 GB');
});
