// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { browserRouter, location, mount } from "../test.setup";
import { Route } from "./client";
import { generateRoutes } from "./routes";
import { scanExports } from "./vite/scan";

describe("app/ routing (codegen)", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  /** Build a temp `app/` tree from a path→source map and generate its router module. */
  function generate(files: Record<string, string>): Promise<string> {
    const root = mkdtempSync(join(tmpdir(), "routes-"));
    dirs.push(root);

    const appDir = join(root, "app");
    for (const [path, src] of Object.entries(files)) {
      const full = join(appDir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, src);
    }

    return generateRoutes(appDir, join(root, "out"), scanExports);
  }

  const PAGE = "export function Page(){ return null }";
  const LAYOUT = "export function Layout({ children }){ return children }";
  const LOADING = "export function Loading(){ return null }";
  const CATCH = "export function Catch(){ return null }";
  const NOTFOUND = "export function NotFound(){ return null }";
  const ENTER = "export default () => '/login'";

  it("root is always a scope; lone index becomes the \"/\" page + implicit 404", async () => {
    const out = await generate({ "index.tsx": PAGE });
    expect(out).toContain('import { NotFound, Route, Router } from "@expressive/dev";');
    expect(out).toContain('import { Page as Root } from "../app/index.tsx";');
    expect(out).toMatch(/<Route NotFound={NotFound}>\s*<Route as={Root} \/>/);
  });

  it("a user NotFound suppresses the implicit 404 (no NotFound import)", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${NOTFOUND}` });
    expect(out).toContain('import { Route, Router } from "@expressive/dev";');
    expect(out).not.toContain("{ NotFound, Route, Router }");
    expect(out).toContain("<Route NotFound={RootNotFound}>");
  });

  it("Layout makes a scope; index page is a to-less child; NotFound rides as a prop", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${LAYOUT}\n${NOTFOUND}` });
    expect(out).toContain("import { Page as Root, Layout as RootLayout, NotFound as RootNotFound }");
    expect(out).toMatch(/<Route as={RootLayout} NotFound={RootNotFound}>\s*<Route as={Root} \/>/);
  });

  it("Loading → fallback prop, Catch → Catch prop on the (root) scope", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${LOADING}\n${CATCH}` });
    expect(out).toContain("{ Page as Root, Loading as RootLoading, Catch as RootCatch }");
    expect(out).toMatch(/<Route NotFound={NotFound} fallback={<RootLoading \/>} Catch={RootCatch}>\s*<Route as={Root} \/>/);
  });

  it("default entry hook rides as the `enter` prop on a leaf", async () => {
    const out = await generate({ "index.tsx": PAGE, "(admin).tsx": `${PAGE}\n${ENTER}` });
    expect(out).toContain('import AdminEnter, { Page as Admin } from "../app/(admin).tsx";');
    expect(out).toContain('<Route to="admin" as={Admin} enter={AdminEnter} />');
  });

  it("default entry hook gates a section (rides on the scope)", async () => {
    const out = await generate({ "admin/index.tsx": `${PAGE}\n${LAYOUT}\n${ENTER}`, "admin/[id].tsx": PAGE });
    expect(out).toContain("import AdminEnter, { Page as Admin, Layout as AdminLayout }");
    expect(out).toMatch(/<Route to="admin" as={AdminLayout} enter={AdminEnter}>/);
  });

  it("(about) is a static leaf → to=\"about\", loaded on demand", async () => {
    const out = await generate({ "index.tsx": PAGE, "(about).tsx": PAGE });
    expect(out).toContain('const About = () => import("../app/(about).tsx").then(m => m.Page);');
    expect(out).toContain('<Route to="about" as={About} />');
    expect(out).toContain('import { Page as Root } from "../app/index.tsx";');
  });

  it("a module exporting Loading, Catch or a hook is imported statically", async () => {
    const out = await generate({ "index.tsx": PAGE, "(about).tsx": `${PAGE}\n${LOADING}`, "(admin).tsx": `${PAGE}\n${ENTER}` });
    expect(out).toContain('import { Page as About, Loading as AboutLoading } from "../app/(about).tsx";');
    expect(out).toContain('import AdminEnter, { Page as Admin } from "../app/(admin).tsx";');
    expect(out).not.toContain("import(");
  });

  it("a default-exported class is the scope's State, not an entry hook", async () => {
    const out = await generate({ "index.tsx": PAGE, "admin/index.tsx": `${PAGE}\nexport default class Session extends State {}`, "admin/[id].tsx": PAGE });
    expect(out).toContain('import AdminScope, { Page as Admin } from "../app/admin/index.tsx";');
    expect(out).toMatch(/<Route to="admin" scope={AdminScope}>/);
    expect(out).not.toContain("enter={AdminScope}");
  });

  it("a default-exported class makes a lone page a scope", async () => {
    const out = await generate({ "index.tsx": PAGE, "(settings).tsx": `${PAGE}\nclass Panel extends State {}\nexport { Panel as default }` });
    expect(out).toMatch(/<Route to="settings" scope={SettingsScope}>\s*<Route as={Settings} \/>/);
  });

  it("[slug] is a dynamic segment → to=\":slug\"", async () => {
    const out = await generate({ "blog/index.tsx": PAGE, "blog/[slug].tsx": PAGE });
    expect(out).toContain('<Route to="blog">');
    expect(out).toContain('<Route to=":slug" as={BlogSlug} />');
  });

  it("[...] is a catch-all → to=\"*\"", async () => {
    const out = await generate({ "docs/[...].tsx": PAGE });
    expect(out).toContain('<Route to="*" as={DocsCatchall} />');
  });

  it("bare-named files are support modules, ignored", async () => {
    const out = await generate({ "index.tsx": PAGE, "Logo.tsx": PAGE, "blog/index.tsx": PAGE, "blog/Card.tsx": PAGE });
    expect(out).not.toContain("Logo");
    expect(out).not.toContain("Card");
  });

  it("api directory is skipped (server lane)", async () => {
    const out = await generate({ "index.tsx": PAGE, "api/index.tsx": PAGE });
    expect(out).not.toContain("api/");
  });

  it("childless page folder collapses to a self-closing leaf", async () => {
    const out = await generate({ "index.tsx": PAGE, "blog/index.tsx": PAGE });
    expect(out).toContain('<Route to="blog" as={Blog} />');
    expect(out).not.toContain('<Route to="blog">');
  });

  it("folder with index + child nests the index as a bare child", async () => {
    const out = await generate({ "blog/index.tsx": PAGE, "blog/[slug].tsx": PAGE });
    expect(out).toMatch(/<Route to="blog">\s*<Route as={Blog} \/>/);
  });

  it("emits Route directly - no per-node subclasses", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${LAYOUT}`, "blog/index.tsx": PAGE, "blog/[slug].tsx": PAGE });
    expect(out).not.toContain("extends Route");
    expect(out).not.toMatch(/class \w+Route/);
  });

  it("scans exports through TypeScript and JSX", async () => {
    const out = await generate({
      "index.tsx": `import { Route, Router } from "@expressive/dev";
        type Props = { n: number };
        export class Page extends Route { render() { return <h1>{this.match?.x satisfies string | undefined}</h1>; } }
        export const Layout = (p: Props) => <div>{p.n}</div>;
        export default async function (route: Route): Promise<string | void> {}`,
    });
    expect(out).toContain("import RootEnter, { Page as Root, Layout as RootLayout }");
  });

  it("module always exports a default App component, host-neutral", async () => {
    const out = await generate({ "index.tsx": PAGE });
    expect(out).toContain("const App = () => (");
    expect(out).toContain("export default App;");
    expect(out).not.toContain("@expressive/router");
    expect(out).not.toContain("@expressive/react");
    expect(out).not.toContain("@expressive/dom");
  });
});

// Mirrors the generator's emit: every node is a `Route` element directly, mounted on @expressive/dom.
describe("app/ routing (runtime)", () => {
  browserRouter();

  const RootLayout = (props: { children?: any }) => <div data-root>{props.children}</div>;
  const Home = () => <h1>home</h1>;
  const BlogIndex = () => <p>blog-index</p>;
  const BlogPost = () => {
    const { match } = Route.get();
    return <article>post:{match!.slug}</article>;
  };
  const NotFound = () => <p>not-found</p>;

  const Tree = () => (
    <Route as={RootLayout} NotFound={NotFound}>
      <Route as={Home} />
      <Route to="blog">
        <Route as={BlogIndex} />
        <Route to=":slug" as={BlogPost} />
      </Route>
    </Route>
  );

  const rootText = async () => (await mount(Tree)).querySelector("[data-root]")?.textContent;

  it("/ → RootLayout > Home", async () => {
    location("/");
    expect(await rootText()).toBe("home");
  });

  it("/blog → RootLayout > BlogIndex", async () => {
    location("/blog");
    expect(await rootText()).toBe("blog-index");
  });

  it("/blog/:slug → nested scope resolves", async () => {
    location("/blog/hello");
    expect(await rootText()).toBe("post:hello");
  });

  it("/nope → NotFound", async () => {
    location("/nope");
    expect(await rootText()).toBe("not-found");
  });
});
