import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ensureBootstrap, resolveProject } from "./project";

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
