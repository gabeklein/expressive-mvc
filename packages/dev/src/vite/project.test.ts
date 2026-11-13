// @vitest-environment happy-dom

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { bootstrap, ensureBootstrap, resolveProject } from "./project";

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "project-"));

  for (const [file, source] of Object.entries(files)) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), source);
  }

  return root;
}

describe("resolveProject", () => {
  it("will find a single-file app with an index.ts and index.html", () => {
    const root = project({ "src/app.tsx": "", "index.ts": "", "index.html": "" });

    expect(resolveProject(root)).toEqual({
      root,
      appPath: join(root, "src/app.tsx"),
      configPath: join(root, "index.ts"),
      htmlPath: join(root, "index.html"),
    });
  });

  it("will throw if app/ and app.tsx both exist", () => {
    expect(() => resolveProject(project({ "app/index.tsx": "", "app.tsx": "" }))).toThrow("pick routed mode or single-file");
  });

  it("will throw if app.tsx and src/app.tsx both exist", () => {
    expect(() => resolveProject(project({ "app.tsx": "", "src/app.tsx": "" }))).toThrow("pick one");
  });

  it("will throw if there is no app", () => {
    expect(() => resolveProject(project({}))).toThrow("Missing app.tsx");
  });
});

describe("ensureBootstrap", () => {
  it("will add the root and script before </body>", () => {
    const html = ensureBootstrap("<html><body></body></html>");

    expect(html).toMatch(/<div id="root"><\/div>\n\s+<script type="module" src="\/\.expressive\/main\.tsx"><\/script>\n\s+<\/body>/);
  });

  it("will append both to a shell without </body>", () => {
    expect(ensureBootstrap("<p></p>")).toBe(
      `<p></p>\n<div id="root"></div>\n\n<script type="module" src="/.expressive/main.tsx"></script>\n`
    );
  });

  it("will keep a shell that already bootstraps", () => {
    const html = `<div id='root'></div><script type="module" src="/.expressive/main.tsx"></script>`;

    expect(ensureBootstrap(html)).toBe(html);
  });
});

describe("bootstrap", () => {
  const boot = (render: (node: unknown, el: HTMLElement) => void) => {
    const body = bootstrap("./app").replace(/^import .*$/gm, "");
    new Function("render", "jsx", "App", body)(render, () => "app", undefined);
  };

  const settle = () => new Promise(done => setTimeout(done, 10));

  it("will render into an empty root", () => {
    document.body.innerHTML = `<div id="root"></div>`;
    const render = vi.fn();

    boot(render);

    expect(render).toHaveBeenCalledWith("app", document.getElementById("root"));
  });

  it("will throw without a root", () => {
    document.body.innerHTML = "";

    expect(() => boot(vi.fn())).toThrow("Missing #root element");
  });

  it("will keep a prerendered root until the app shows the same text", async () => {
    document.head.innerHTML = `<meta charset="utf-8"><!--prerender--><title>Page</title><!--/prerender--><title>Shell</title><!--prerender--><style></style><!--/prerender--><style data-expressive="dom"></style>`;
    document.body.innerHTML = `<div id="root" class="app"><p>Hi</p></div>`;
    const prerendered = document.getElementById("root")!;
    let target!: HTMLElement;

    boot((_, el) => {
      target = el;
      el.textContent = "Loading";
    });

    await settle();
    expect(document.getElementById("root")).toBe(prerendered);
    expect(target.hidden).toBe(true);

    target.innerHTML = "<p>Hi</p>";
    await settle();

    expect(document.querySelectorAll("#root")).toHaveLength(1);
    expect(document.getElementById("root")).toBe(target);
    expect(target.className).toBe("app");
    expect(target.hidden).toBe(false);
    expect(document.head.innerHTML).toBe(`<meta charset="utf-8"><title>Shell</title><style data-expressive="dom"></style>`);
  });

  it("will swap a prerendered root after a second regardless", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    document.body.innerHTML = `<div id="root"><p>Hi</p></div>`;
    let target!: HTMLElement;

    boot((_, el) => {
      target = el;
      el.textContent = "Other";
    });

    vi.advanceTimersByTime(1000);

    expect(document.getElementById("root")).toBe(target);
    vi.useRealTimers();
  });

  it("will swap at once when the app renders the same text in its first pass", () => {
    document.body.innerHTML = `<div id="root"><p>Hi</p></div>`;
    let target!: HTMLElement;

    boot((_, el) => {
      target = el;
      el.innerHTML = "<p>Hi</p>";
    });

    expect(document.getElementById("root")).toBe(target);
  });
});
