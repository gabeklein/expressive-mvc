import { expect, test } from "@playwright/test";

test("will set a cookie from a call, and read it back on the next", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as alice" }).click();
  await page.getByRole("button", { name: "Use the dark theme" }).click();
  await expect(page.locator("#theme")).toHaveText("was unset");

  const [cookie] = (await context.cookies()).filter(cookie => cookie.name === "theme");

  expect(cookie).toMatchObject({ value: "dark", path: "/", httpOnly: true, sameSite: "Lax" });
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 60 * 60 * 24 * 300);

  await page.getByRole("button", { name: "Use the dark theme" }).click();
  await expect(page.locator("#theme")).toHaveText("was dark");
  await expect(page.getByRole("alert")).toBeEmpty();
});
