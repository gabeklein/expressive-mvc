import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { launch, type Renderer } from "./render";

const SHELL = `<!doctype html><html><head><script type="module" src="/main.js"></script></head><body><div id="root"></div></body></html>`;

describe("renderPage", { timeout: 30_000 }, () => {
  const dirs: string[] = [];
  let renderer: Renderer;

  beforeAll(async () => {
    renderer = await launch();
  }, 60_000);

  afterAll(() => renderer?.close());

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  function client(files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "prerender-"));
    dirs.push(dir);

    for (const [file, source] of Object.entries(files)) writeFileSync(join(dir, file), source);

    return dir;
  }

  it("will wait for timers, chunks and calls to settle, then serialize the document", async () => {
    const dir = client({
      "chunk.js": `export const text = "Hello";`,
      "main.js": `
        const style = document.createElement("style");
        style.dataset.expressive = "dom";
        document.head.append(style);
        style.sheet.insertRule(".a { inset: 0; color: color-mix(in srgb, red 50%, blue); }", 0);
        console.log("booting");
        fetch("/.expressive/call", { method: "POST" });
        new EventSource("/.expressive/stream");
        setTimeout(async () => {
          const { text } = await import("./chunk.js");
          const link = document.createElement("link");
          link.rel = "modulepreload";
          link.href = new URL("/chunk.js", location.href).href;
          document.head.append(link);
          document.getElementById("root").innerHTML = '<p class="a">' + text + "</p>";
        }, 50);
      `,
    });

    const page = await renderer.render({ dir, shell: SHELL, path: "/about" });

    expect(page.path).toBe("/about");
    expect(page.blank).toBe(false);
    expect(page.html).toMatch(/^<!doctype html>\n<html>/);
    expect(page.html).toContain(`<p class="a">Hello</p>`);
    expect(page.html).toContain(`<link rel="modulepreload" href="/chunk.js">`);
    expect(page.html).toContain(`<style data-expressive="prerender">.a { inset: 0px; color: color-mix(in srgb, red, blue); }</style>`);
  });

  it("will report the path a page moved to", async () => {
    const dir = client({ "main.js": `history.replaceState(null, "", "/elsewhere"); document.getElementById("root").textContent = "moved";` });

    expect(await renderer.render({ dir, shell: SHELL, path: "/" })).toMatchObject({ path: "/elsewhere", blank: false });
  });

  it("will report a page that renders nothing", async () => {
    const dir = client({ "main.js": "" });

    expect(await renderer.render({ dir, shell: SHELL, path: "/" })).toMatchObject({ blank: true });
  });

  it("will throw the errors a page logs", async () => {
    const dir = client({ "main.js": `console.error("broke"); fetch("http://127.0.0.1:9/"); import("./missing.js");` });

    await expect(renderer.render({ dir, shell: SHELL, path: "/" })).rejects.toThrow("broke");
  });

  it("will throw if a page does not settle", async () => {
    const dir = client({ "main.js": `setInterval(() => (document.getElementById("root").textContent = Math.random()), 5);` });

    await expect(renderer.render({ dir, shell: SHELL, path: "/", timeout: 200 })).rejects.toThrow("did not settle within 200ms.");
  });
});

it("will throw if playwright-core is missing", async () => {
  vi.resetModules();
  vi.doMock("playwright-core", () => {
    throw new Error("Cannot find package");
  });

  const { launch } = await import("./render");

  await expect(launch()).rejects.toThrow("Prerendering needs playwright-core");

  vi.doUnmock("playwright-core");
});
