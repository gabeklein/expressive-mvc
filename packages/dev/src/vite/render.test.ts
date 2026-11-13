import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { launch } from "./render";

const PACKAGES = fileURLToPath(new URL("../../../", import.meta.url));
const CONFIG = `export default {
  resolve: {
    alias: [
      { find: /^@expressive\\/([^/]+)$/, replacement: ${JSON.stringify(PACKAGES)} + "$1/src" },
      { find: /^@expressive\\/([^/]+)\\/(.+)$/, replacement: ${JSON.stringify(PACKAGES)} + "$1/src/$2" },
    ],
  },
};
`;
const SHELL = `<html><head><title>t</title></head><body><div id="root"></div></body></html>`;

describe("launch", { timeout: 30_000 }, () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  function project(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), "prerender-"));
    dirs.push(root);

    for (const [file, source] of Object.entries({ "vite.config.mjs": CONFIG, ...files })) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), source);
    }

    return root;
  }

  it("will render a routed page at its path into the shell, with the rules it used", async () => {
    const root = project({
      "app/index.tsx": `
        import { style } from "@expressive/dev";
        export const Page = () => <h1>home</h1>;
        export function Layout(props) { return <main>{props.children}</main>; }
        style(Layout, { color: "teal" });
      `,
      "app/(about).tsx": `export const Page = () => <h2>about</h2>;`,
      "app/blog/[slug].tsx": `
        import { Route } from "@expressive/dev";
        export const Page = () => <h3>{Route.get().match.slug}</h3>;
        export const paths = async () => ["/blog/a", "/blog/b"];
      `,
    });
    const renderer = await launch(root);

    expect(await renderer.paths()).toEqual(["/blog/a", "/blog/b"]);
    expect((await renderer.render("/blog/b", SHELL)).html).toContain("<h3>b</h3>");

    const about = await renderer.render("/about", SHELL);

    expect(about.path).toBe("/about");
    expect(about.blank).toBe(false);
    expect(about.html).toMatch(/^<html><head><title>t<\/title><style data-expressive="prerender">\.Layout\{color: teal;\}<\/style>\n<\/head><body><div id="root"><!--fragment-->.*<main class="Layout">.*<h2>about<\/h2>.*<\/main>.*<\/div><\/body><\/html>$/);
    expect(about.html).not.toContain("<h1>");

    renderer.close();
    expect(existsSync(join(root, "dist", ".prerender"))).toBe(false);
  });

  it("will report where a page redirects and when it renders nothing", async () => {
    const root = project({
      "app/index.tsx": `export const Page = () => null;`,
      "app/(old).tsx": `import { Redirect } from "@expressive/dev"; export const Page = () => <Redirect to="/" />;`,
    });
    const renderer = await launch(root);

    expect(await renderer.render("/old", SHELL)).toMatchObject({ path: "/" });
    expect(await renderer.render("/", SHELL)).toMatchObject({ path: "/", blank: true });
    renderer.close();
  });

  it("will render a single-file app, into a root with attributes", async () => {
    const root = project({
      "app.tsx": `export default () => <p>single</p>;`,
    });
    const renderer = await launch(root);
    const page = await renderer.render("/", `<head></head><div id="root" class="x">\n</div>`);

    expect(page.html).toBe(`<head></head><div id="root" class="x"><!--fragment--><!--function--><p>single</p><!--/function--><!--/fragment--></div>`);
    await expect(renderer.render("/", `<div id="app"></div>`)).rejects.toThrow("The shell has no empty #root element.");
    renderer.close();
  });

  it("will bundle a remote module as its client stub", async () => {
    const root = project({
      "app/index.tsx": `export const Page = () => <p>home</p>;`,
      "app/tally/index.tsx": `import { add } from "./remote"; export const Page = () => <p>{String(typeof add)}</p>;`,
      "app/tally/remote.ts": `export async function add(a: number, b: number) { return "SERVER_ONLY_" + (a + b); }`,
    });
    const renderer = await launch(root);
    const out = join(root, "dist", ".prerender");
    const code = readdirSync(out, { recursive: true })
      .filter((file) => String(file).endsWith(".js"))
      .map((file) => readFileSync(join(out, String(file)), "utf8"))
      .join("\n");

    expect(code).toContain("tally/remote");
    expect(code).not.toContain("SERVER_ONLY_");
    renderer.close();
  });
});
