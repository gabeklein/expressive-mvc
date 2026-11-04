import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const files = ["../api/todos.ts", "../api/index.ts"].map(path => new URL(path, import.meta.url));
const saved = files.map(file => readFileSync(file, "utf8"));

function edit(file: URL, from: string, to: string) {
  const source = readFileSync(file, "utf8");

  expect(source).toContain(from);
  writeFileSync(file, source.replace(from, to));
}

test.afterEach(() => files.forEach((file, i) => writeFileSync(file, saved[i])));

test("will answer calls through a gate after an edit to an api module and the gate", async ({ page }) => {
  const error = page.getByRole("alert");

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as alice" }).click();
  await expect(page.locator("#todos li").filter({ hasText: "Read the docs" })).toHaveCount(1);

  edit(files[0], "Titles over 40 characters are a Pro feature.", "Long titles are a Pro feature.");
  await expect(async () => {
    await page.getByPlaceholder("What needs doing?").fill("x".repeat(41));
    await page.getByRole("button", { name: "Add" }).click();
    await expect(error).toHaveText("ProOnly HttpError: Long titles are a Pro feature.", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  edit(files[1], "Sign in first.", "Sign in, please.");
  await expect(async () => {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(error).toHaveText("Unauthorized HttpError: Sign in, please.", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "Sign in as alice" }).click();
  await expect(page.locator("#todos li").filter({ hasText: "Read the docs" })).toHaveCount(1);
  await expect(error).toBeEmpty();
});
