import type { BrowserContext } from "@playwright/test";

import { expect, test } from "./fixture";

const pass = (context: BrowserContext, url: string | undefined, value: string) => context.addCookies([{ name: "gate", value, url: url! }]);

test("admits a visitor the gate lets through, with its seat already fetched", async ({ page, context, baseURL, open }) => {
  await pass(context, baseURL, "ada");
  await open("/gate");

  await expect(page.getByRole("heading")).toHaveText("Gate");
  await expect(page.getByText("Welcome, ada")).toBeVisible();
});

test("holds the current page until the gate admits a navigation", async ({ page, context, baseURL, open }) => {
  let release!: () => void;
  const held = new Promise<void>(done => (release = done));

  await pass(context, baseURL, "ada");
  await page.route(url => url.pathname == "/gate", async route => {
    if (route.request().method() == "POST") await held;
    await route.continue();
  });

  await open("/");
  await page.getByRole("link", { name: "Gate" }).click();
  await expect(page.getByRole("heading")).toHaveText("Home");
  await expect(page).toHaveURL("/");

  release();
  await expect(page.getByRole("heading")).toHaveText("Gate");
  await expect(page).toHaveURL("/gate");
});

test("shows Catch when the gate refuses the visitor", async ({ page, context, baseURL, open: _ }) => {
  await pass(context, baseURL, "banned");
  await page.goto("/gate");

  await expect(page.getByRole("alert")).toContainText("Banned from the gate.");
});

test("redirects where the gate's refusal names a location", async ({ page, open }) => {
  await open("/gate");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading")).toHaveText("Login");
});

test("redirects from the entry hook, which reads the fetched seat", async ({ page, context, baseURL, open }) => {
  await pass(context, baseURL, "guest");
  await open("/gate");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading")).toHaveText("Login");
});

test("leaves the gate for another page while its admission is still pending", async ({ page, context, baseURL, open: _ }) => {
  await pass(context, baseURL, "ada");
  await page.route(url => url.pathname == "/gate", async route => {
    if (route.request().method() != "POST") return route.continue();
  });

  await page.goto("/gate");
  await expect(page.getByText("Loading…")).toBeVisible();

  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading")).toHaveText("About");
});
