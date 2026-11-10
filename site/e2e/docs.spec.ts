import { expect, test as base } from "@playwright/test";

const test = base.extend<{ open: (path: string) => Promise<void> }>({
  open: async ({ page }, use) => {
    const errors: string[] = [];

    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() == "error") errors.push(message.text());
    });

    await use(async path => {
      await page.goto(path);
      await page.locator("article h1").waitFor();
    });

    expect(errors, "page errors and console.error").toEqual([]);
  },
});

test("renders a page with headings through the override", async ({ page, open }) => {
  await open("/docs/getting-started");

  await expect(page).toHaveTitle("Getting Started - Expressive");
  await expect(page.locator("article h1")).toHaveText(/^Getting Started/);

  const install = page.locator("article h2#install");

  await expect(install).toHaveText("Install#");
  await expect(install.locator('a[href="#install"]')).toHaveCount(1);
  await expect(page.locator('aside nav a[href="#install"]')).toHaveText("Install");
  await expect(page.locator("[data-playground]")).toHaveAttribute("data-playground", "essentials/counter");
});

test("renders the index with cards that navigate in-app", async ({ page, open }) => {
  await open("/docs");
  await expect(page.locator("article h1")).toHaveText(/^Expressive MVC/);

  await page.evaluate(() => ((window as { marker?: number }).marker = 1));
  await page.locator("article a", { hasText: "Why Classes?" }).first().click();

  await expect(page).toHaveURL(/\/docs\/why-classes$/);
  await expect(page.locator("article h1")).toHaveText(/^Why Classes\?/);
  expect(await page.evaluate(() => (window as { marker?: number }).marker)).toBe(1);
});

test("switches Compare panels", async ({ page, open }) => {
  await open("/docs/why-classes");

  const compare = page.locator("article [role=tablist]").first();

  await expect(compare.locator("button")).toHaveText(["Model class", "Hooks"]);
  await expect(page.locator("article pre").first()).toContainText("class UserSettings extends Model");

  await compare.locator("button", { hasText: "Hooks" }).click();
  await expect(compare.locator("button[aria-selected=true]")).toHaveText("Hooks");
  await expect(page.locator("article pre").first()).not.toContainText("class UserSettings extends Model");
});

test("navigates from the sidebar", async ({ page, open }) => {
  await open("/docs/getting-started");

  await page.locator("nav a", { hasText: "Router" }).first().click();

  await expect(page).toHaveURL(/\/docs\/guides\/router$/);
  await expect(page.locator("article h1")).toHaveText(/^Router/);
  await expect(page.locator('nav a[aria-current="page"]')).toHaveText("Router");
});

test("a nested folder shadows the docs components", async ({ page, open }) => {
  await open("/docs/api/state");

  await expect(page.locator("article [data-api] h2").first()).toBeVisible();

  await page.locator("nav a", { hasText: "Getting Started" }).click();
  await expect(page.locator("article h1")).toHaveText(/^Getting Started/);
  await expect(page.locator("article [data-api]")).toHaveCount(0);
});

test("shows not found for an unknown page", async ({ page }) => {
  await page.goto("/docs/nope");
  await expect(page.locator("h1")).toHaveText("Page not found");
});

test("scrolls to the hash on a cold load and to the top on navigation", async ({ page, open }) => {
  await open("/docs/getting-started#requirements");

  await expect.poll(() => page.locator("#requirements").evaluate(e => Math.round(e.getBoundingClientRect().top))).toBeLessThan(40);

  await page.locator("nav a", { hasText: "Reactivity" }).click();
  await expect(page.locator("article h1")).toHaveText(/^Reactivity/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
