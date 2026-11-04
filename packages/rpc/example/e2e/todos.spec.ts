import { expect, test, type Page } from "@playwright/test";

const error = (page: Page) => page.getByRole("alert");
const todos = (page: Page) => page.locator("#todos li");

async function signIn(page: Page, who: "alice" | "admin") {
  await page.goto("/");
  await page.getByRole("button", { name: `Sign in as ${who}` }).click();
  await expect(page.locator("#who")).toHaveText(who);
}

test("will list todos for a signed-in user", async ({ page }) => {
  await signIn(page, "alice");

  await expect(todos(page).filter({ hasText: "Read the docs" })).toHaveCount(1);
  await expect(error(page)).toBeEmpty();
});

test("will keep an added todo across a reload, and complete it", async ({ page }) => {
  const title = `Water plants ${crypto.randomUUID().slice(0, 8)}`;

  await signIn(page, "alice");
  await page.getByPlaceholder("What needs doing?").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(todos(page).filter({ hasText: title })).toHaveAttribute("data-done", "false");

  await page.reload();
  await expect(todos(page).filter({ hasText: title })).toHaveCount(1);

  await todos(page).filter({ hasText: title }).getByRole("button", { name: "Done" }).click();
  await expect(todos(page).filter({ hasText: title })).toHaveAttribute("data-done", "true");
  await expect(error(page)).toBeEmpty();
});

test("will catch a NotFound as NotFound and HttpError", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByRole("button", { name: "Complete a missing todo" }).click();

  await expect(error(page)).toHaveText("NotFound HttpError: No todo missing.");
});

test("will catch an exported HttpError subclass as itself", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByPlaceholder("What needs doing?").fill("x".repeat(41));
  await page.getByRole("button", { name: "Add" }).click();

  await expect(error(page)).toHaveText("ProOnly HttpError: Titles over 40 characters are a Pro feature.");
});

test("will refuse every call without a token", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(error(page)).toHaveText("Unauthorized HttpError: Sign in first.");
  await expect(todos(page)).toHaveCount(0);
});

test("will refuse an admin call to a user, and answer an admin", async ({ page }) => {
  await signIn(page, "alice");
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(error(page)).toHaveText("Forbidden HttpError: Admins only.");

  await page.getByRole("button", { name: "Sign in as admin" }).click();
  await page.getByRole("button", { name: "Stats" }).click();
  await expect(page.locator("#count")).toHaveText(/^\d+ of \d+ done$/);
  await expect(error(page)).toBeEmpty();
});
