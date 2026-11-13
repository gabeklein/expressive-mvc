import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { Page } from "./render";

const launch = vi.hoisted(() => vi.fn());

vi.mock("./render", () => ({ launch }));

import { prerender } from "./prerender";

const PAGE = "export function Page() { return null }";
const SHELL = `<div id="root"></div>`;

const dirs: string[] = [];
let warn: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function built(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "prerender-"));
  dirs.push(root);

  for (const [file, source] of Object.entries({ ...files, "dist/client/index.html": SHELL })) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), source);
  }

  return root;
}

function renderer(render: (path: string, shell: string) => Page) {
  const close = vi.fn();
  launch.mockResolvedValueOnce({ render: async (path: string, shell: string) => render(path, shell), close });
  return { close };
}

it("will write each static page and keep the shell as 200.html", async () => {
  const root = built({ "app/index.tsx": PAGE, "app/(about).tsx": PAGE, "app/docs/(intro).tsx": PAGE, "app/blog/[slug].tsx": PAGE });
  const { close } = renderer((path, shell) => ({ path, blank: false, html: `${path} ${shell}` }));
  const client = join(root, "dist", "client");

  expect(await prerender(root)).toEqual(["/", "/about", "/docs/intro"]);
  expect(readFileSync(join(client, "200.html"), "utf8")).toBe(SHELL);
  expect(readFileSync(join(client, "index.html"), "utf8")).toBe(`/ ${SHELL}`);
  expect(readFileSync(join(client, "docs", "intro", "index.html"), "utf8")).toBe(`/docs/intro ${SHELL}`);
  expect(existsSync(join(client, "blog"))).toBe(false);
  expect(close).toHaveBeenCalled();
  expect(launch).toHaveBeenCalledWith(root);
  expect(log).toHaveBeenCalledWith("Prerendered 3 pages.");
});

it("will leave a page that moves, renders nothing or fails to the client", async () => {
  const root = built({ "app/(a).tsx": PAGE, "app/(b).tsx": PAGE, "app/(c).tsx": PAGE, "app/(d).tsx": PAGE });
  renderer((path) => {
    if (path == "/a") return { path: "/", blank: false, html: "" };
    if (path == "/b") return { path, blank: true, html: "" };
    if (path == "/c") throw new Error("broke");
    return { path, blank: false, html: "d" };
  });

  expect(await prerender(root)).toEqual(["/d"]);
  expect(warn.mock.calls.map(([message]: unknown[]) => message)).toEqual([
    "/a redirected to / at build - left to the client.",
    "/b rendered nothing at build - left to the client.",
    "/c was not prerendered: broke",
  ]);
  expect(log).toHaveBeenCalledWith("Prerendered 1 page.");
});

it("will render a single-file app at its root", async () => {
  const root = built({ "app.tsx": "export default () => null" });
  renderer((path) => ({ path, blank: false, html: "app" }));

  expect(await prerender(root)).toEqual(["/"]);
  expect(readFileSync(join(root, "dist", "client", "index.html"), "utf8")).toBe("app");
});
