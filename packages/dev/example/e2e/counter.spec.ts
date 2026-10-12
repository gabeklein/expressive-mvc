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

test("shows another tab's change without a call of its own", async ({ page, context, open }) => {
  await open("/counter");
  const output = page.locator("output");
  const before = Number(await output.textContent());

  const other = await context.newPage();
  await other.goto("/counter");
  await other.getByRole("button", { name: "Increment" }).click();

  await expect.poll(async () => Number(await output.textContent())).toBeGreaterThan(before);
});

test("gives each use() of a remote class its own server instance, for the life of the page", async ({ page, open }) => {
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

test("reads an owned child through its owner's twin, and calls its methods", async ({ page, open }) => {
  await open("/counter");
  const tap = page.getByRole("button", { name: /^Left/ });
  const since = page.locator("small").filter({ hasText: /^Left/ });

  await expect(since).toHaveText("Left since clear: 0");

  await tap.click();
  await tap.click();
  await expect(since).toHaveText("Left since clear: 2");

  await page.getByRole("button", { name: "Clear Left" }).click();
  await expect(since).toHaveText("Left since clear: 0");
  await expect(tap).toHaveText("Left 2");

  await tap.click();
  await expect(since).toHaveText("Left since clear: 1");

  await page.getByRole("button", { name: "Restart Left" }).click();
  await expect(tap).toHaveText("Left 0");
  await expect(since).toHaveText("Left since clear: 0");

  await tap.click();
  await expect(since).toHaveText("Left since clear: 1");
});
