import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { Browser, Request, Route } from "playwright-core";

export interface Job {
  dir: string;
  shell: string;
  path: string;
  timeout?: number;
}

export interface Page {
  path: string;
  html: string;
  blank: boolean;
}

export interface Renderer {
  render(job: Job): Promise<Page>;
  close(): Promise<void>;
}

const ORIGIN = "http://prerender.localhost";
const QUIET = 25;

const PROBE = `(() => {
  const live = new Set();
  const { setTimeout: start, clearTimeout: stop } = window;
  const probe = (window.__prerender = { changes: 0, idle: () => !live.size });

  window.setTimeout = (run, ms, ...args) => {
    const id = start(() => {
      live.delete(id);
      if (typeof run == "function") run(...args);
    }, ms);
    live.add(id);
    return id;
  };
  window.clearTimeout = id => {
    live.delete(id);
    stop(id);
  };

  new MutationObserver(() => probe.changes++).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
})()`;

const STATE = "({ idle: window.__prerender.idle(), changes: window.__prerender.changes })";

const SNAPSHOT = `(() => {
  for (const style of document.querySelectorAll("style[data-expressive]")) {
    style.textContent = [...style.sheet.cssRules].map(rule => rule.cssText).join("\\n");
    style.dataset.expressive = "prerender";
  }

  for (const link of document.querySelectorAll('link[href^="' + location.origin + '/"]')) {
    link.setAttribute("href", new URL(link.href).pathname);
  }

  const root = document.getElementById("root");
  const blank = !root || !(root.querySelector("*") || root.textContent.trim());

  return { blank, html: "<!doctype html>\\n" + document.documentElement.outerHTML + "\\n" };
})()`;

/** Start headless Chrome - `CHROME` names a binary, else the installed Chrome. */
export async function launch(): Promise<Renderer> {
  let chromium: typeof import("playwright-core").chromium;

  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new Error("Prerendering needs playwright-core installed beside @expressive/dev, and Chrome.");
  }

  const browser = await chromium.launch({ channel: "chrome", executablePath: process.env.CHROME });

  return {
    render: job => renderPage(browser, job),
    close: () => browser.close(),
  };
}

const parked = (request: Request) => request.method() != "GET" || new URL(request.url()).pathname.startsWith("/.expressive/");

const local = (request: Request) => new URL(request.url()).origin == ORIGIN;

/** Boot a built client at `path` in a fresh tab, wait for it to settle and return the document. */
export async function renderPage(browser: Browser, { dir, shell, path, timeout = 10_000 }: Job): Promise<Page> {
  const context = await browser.newContext();
  const tab = await context.newPage();
  const loading = new Set<Request>();
  const errors: string[] = [];
  const done = (request: Request) => loading.delete(request);

  tab.on("pageerror", error => errors.push(error.message));
  tab.on("console", message => message.type() == "error" && errors.push(message.text()));
  tab.on("request", request => local(request) && !parked(request) && loading.add(request));
  tab.on("requestfinished", done);
  tab.on("requestfailed", done);

  await tab.addInitScript(PROBE);
  await context.route("**/*", route => serve(route, dir, shell));

  try {
    await tab.goto(ORIGIN + path);

    const deadline = Date.now() + timeout;

    for (let seen = -1; ; ) {
      await sleep(QUIET);

      const { idle, changes } = await tab.evaluate<{ idle: boolean; changes: number }>(STATE);

      if (idle && !loading.size && changes == seen) break;
      if (Date.now() > deadline) throw new Error(`did not settle within ${timeout}ms.`);

      seen = changes;
    }

    if (errors.length) throw new Error(errors.join("\n"));

    return { path: new URL(tab.url()).pathname, ...(await tab.evaluate<Omit<Page, "path">>(SNAPSHOT)) };
  } finally {
    await context.close();
  }
}

function serve(route: Route, dir: string, shell: string) {
  const request = route.request();

  if (!local(request)) return route.continue();
  if (parked(request)) return;
  if (request.isNavigationRequest()) return route.fulfill({ body: shell, contentType: "text/html" });

  const file = join(dir, normalize(decodeURIComponent(new URL(request.url()).pathname)));

  return existsSync(file) && statSync(file).isFile() ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
}
