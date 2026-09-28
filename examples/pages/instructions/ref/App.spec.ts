import { expect, test } from '../../../e2e';

test('will drag the box through its ref', async ({ page, open }) => {
  await open('instructions/ref');
  const surface = page.locator('.surface');
  const box = page.locator('.surface > div');

  await expect(box).toHaveClass('box');
  await expect(box).toHaveText('72, 64');

  const area = (await surface.boundingBox())!;
  const start = (await box.boundingBox())!;
  const grab = { x: start.x + 10, y: start.y + 10 };
  const at = (clientX: number, clientY: number) =>
    `${Math.round(clientX - area.x - 10)}, ${Math.round(clientY - area.y - 10)}`;

  await page.mouse.move(area.x + 300, area.y + 200);
  await expect(box).toHaveText('72, 64');

  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await expect(box).toHaveClass('box dragging');

  await page.mouse.move(grab.x + 128, grab.y + 76, { steps: 8 });
  await expect(box).toHaveText(at(grab.x + 128, grab.y + 76));

  await page.mouse.move(area.x + area.width + 200, area.y - 100, { steps: 8 });
  await expect(box).toHaveText(`${Math.round(area.width - start.width)}, 0`);

  await page.mouse.move(area.x + 60, area.y + 50, { steps: 8 });
  await expect(box).toHaveText(at(area.x + 60, area.y + 50));

  await page.mouse.up();
  await expect(box).toHaveClass('box');

  await page.mouse.move(area.x + 300, area.y + 200, { steps: 4 });
  await expect(box).toHaveText(at(area.x + 60, area.y + 50));
});
