import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

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

test("shows another tab's change without a call of its own", async ({ page, context, open }) => {
  await open("/counter");
  const output = page.locator("output");
  const before = Number(await output.textContent());

  const other = await context.newPage();
  await other.goto("/counter");
  await other.getByRole("button", { name: "Increment" }).click();

  await expect.poll(async () => Number(await output.textContent())).toBeGreaterThan(before);
});

test("gives each construction of a remote class its own server instance, for the life of the page", async ({ page, open }) => {
  await open("/counter");
  const left = page.getByRole("button", { name: /^Left/ });
  const right = page.getByRole("button", { name: /^Right/ });
  const clicks = page.locator("data");

  await expect(left).toHaveText("Left 0");
  const before = Number(await clicks.textContent());

  await left.click();
  await left.click();
  await expect(left).toHaveText("Left 2");
  await expect(right).toHaveText("Right 0");
  await expect.poll(async () => Number(await clicks.textContent())).toBeGreaterThan(before);

  await page.reload();
  await expect(page.getByRole("button", { name: /^Left/ })).toHaveText("Left 0");
});
