import { expect, test } from "./fixture";

test("renders the home page and keeps its state", async ({ page, open }) => {
  await open("/");
  await expect(page.getByRole("heading")).toHaveText("Home");

  const button = page.getByRole("button");
  await button.click();
  await button.click();
  await expect(button).toHaveText("Clicked 2 times");
});

test("navigates between routes through links", async ({ page, open }) => {
  await open("/");

  await page.getByRole("link", { name: "Blog" }).click();
  await expect(page).toHaveURL("/blog");
  await expect(page.getByRole("heading")).toHaveText("Blog index");

  await page.getByRole("link", { name: "Hello post" }).click();
  await expect(page).toHaveURL("/blog/hello");
  await expect(page.getByRole("heading")).toHaveText("Post: hello");

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("heading")).toHaveText("Home");
});

test("provides a route's default class to its pages", async ({ page, open }) => {
  await open("/blog");
  await expect(page.getByRole("listitem")).toHaveText(["hello", "world"]);

  await open("/blog/world");
  await expect(page.getByRole("heading")).toHaveText("Post: world");

  await open("/blog/unknown");
  await expect(page.getByRole("heading")).toHaveText("Post: unknown (draft)");
});

test("an entry hook redirects until it allows the route", async ({ page, open }) => {
  await open("/admin");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading")).toHaveText("Home");

  await page.evaluate(() => localStorage.setItem("admin", "1"));
  await open("/admin");
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading")).toHaveText("Admin area");
});

test("falls through to the 404 page", async ({ page, open }) => {
  await open("/nowhere");
  await expect(page.getByRole("heading")).toHaveText("404");
});

test("loads a route module on first entry", async ({ page, open }) => {
  const loaded: string[] = [];
  const aboutLoaded = () => loaded.some(path => path.includes("(about)"));

  page.on("request", request => {
    const { pathname } = new URL(request.url());
    loaded.push(decodeURIComponent(pathname));
  });

  await open("/");
  expect(aboutLoaded()).toBe(false);

  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading")).toHaveText("About");
  expect(aboutLoaded()).toBe(true);
});

test("shows the layout's Loading while a page's code arrives on a cold load", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(done => (release = done));
  const aboutChunk = (url: URL) => {
    const path = decodeURIComponent(url.pathname);
    const isPage = path.endsWith("/about");

    return path.includes("(about)") && !isPage;
  };

  await page.route(aboutChunk, async route => {
    await held;
    await route.continue();
  });

  await page.goto("/about");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("Loading…")).toBeVisible();

  release();
  await expect(page.getByRole("heading")).toHaveText("About");
  await expect(page.getByText("Loading…")).toHaveCount(0);
});
