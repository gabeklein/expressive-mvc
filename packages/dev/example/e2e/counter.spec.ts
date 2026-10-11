import { expect, test } from "./fixture";

test("reads a route default's values through its twin, kept current by its calls", async ({ page, open }) => {
  await open("/counter");
  const output = page.locator("output");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(output).toHaveText("0");

  await page.getByRole("button", { name: "Increment" }).click();
  await expect(output).toHaveText("1");

  await page.reload();
  await expect(output).toHaveText("1");

  await page.getByRole("button", { name: "Increment" }).click();
  await expect(output).toHaveText("2");
});

test("updates another twin a call moved, in the same reply", async ({ page, open }) => {
  await open("/counter");
  const clicks = page.locator("data");
  const before = Number(await clicks.textContent());

  await page.getByRole("button", { name: "Increment" }).click();
  await expect.poll(async () => Number(await clicks.textContent())).toBeGreaterThan(before);
});
