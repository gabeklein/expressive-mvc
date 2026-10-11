// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Component, State } from "@expressive/mvc";

import { browserRouter, location, mount, settle } from "../../test.setup";
import { Route } from "../client";
import { generateRoutes, remoteOf } from "./routes";
import { scanExports } from "./scan";

describe("app/ routing (codegen)", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  /** Build a temp `app/` tree, generate its router module, and drop the empty boundaries most tests don't assert. */
  async function generate(files: Record<string, string>): Promise<string> {
    return (await generateRaw(files)).replaceAll(" fallback={null}", "");
  }

  function generateRaw(files: Record<string, string>): Promise<string> {
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
  const SCOPE = "export default class Session extends State {}";

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

  it("Loading fills its scope's slot; Catch rides on the scope", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${LOADING}\n${CATCH}` });
    expect(out).toContain("{ Page as Root, Loading as RootLoading, Catch as RootCatch }");
    expect(out).toMatch(/<Route NotFound={NotFound} Catch={RootCatch}>\s*<Route as={Root} fallback={<RootLoading \/>} \/>/);
  });

  it("every route owns a boundary - empty where no Loading applies", async () => {
    const out = await generateRaw({ "index.tsx": PAGE, "(about).tsx": PAGE });
    expect(out).toContain("<Route NotFound={NotFound} fallback={null}>");
    expect(out).toContain("<Route as={Root} fallback={null} />");
    expect(out).toContain('<Route to="about" as={About} fallback={null} />');
  });

  it("Loading covers each route in its Layout's slot, at any depth, but not the Layout", async () => {
    const out = await generateRaw({
      "index.tsx": PAGE,
      "projects/index.tsx": `${PAGE}\n${LAYOUT}\n${LOADING}`,
      "projects/[id].tsx": PAGE,
      "projects/archive/index.tsx": PAGE,
      "projects/archive/[year].tsx": PAGE,
    });
    expect(out).toContain('<Route to="projects" as={ProjectsLayout} fallback={null}>');
    expect(out).toContain("<Route as={Projects} fallback={<ProjectsLoading />} />");
    expect(out).toContain('<Route to=":id" as={ProjectsId} fallback={<ProjectsLoading />} />');
    expect(out).toContain('<Route to="archive" fallback={<ProjectsLoading />}>');
    expect(out).toContain('<Route to=":year" as={ProjectsArchiveYear} fallback={<ProjectsLoading />} />');
  });

  it("a nested Layout starts a fresh slot", async () => {
    const out = await generateRaw({
      "index.tsx": `${PAGE}\n${LOADING}`,
      "settings/index.tsx": `${PAGE}\n${LAYOUT}`,
      "settings/[tab].tsx": PAGE,
    });
    expect(out).toContain('<Route to="settings" as={SettingsLayout} fallback={<RootLoading />}>');
    expect(out).toContain('<Route to=":tab" as={SettingsTab} fallback={null} />');
  });

  it("a page's own Loading covers it before its slot's", async () => {
    const out = await generateRaw({ "index.tsx": `${PAGE}\n${LOADING}`, "(about).tsx": `${PAGE}\n${LOADING}` });
    expect(out).toContain('<Route to="about" as={About} fallback={<AboutLoading />} />');
  });

  it("(about) is a static leaf → to=\"about\", loaded on demand", async () => {
    const out = await generate({ "index.tsx": PAGE, "(about).tsx": PAGE });
    expect(out).toContain('const About = () => import("../app/(about).tsx").then(m => m.Page);');
    expect(out).toContain('<Route to="about" as={About} />');
    expect(out).toContain('import { Page as Root } from "../app/index.tsx";');
  });

  it("will not route a remote/ folder", async () => {
    const out = await generate({ "index.tsx": PAGE, "remote/index.ts": PAGE, "remote/bar.ts": PAGE });
    expect(out).not.toContain("remote");
  });

  it("will throw if a folder has both a remote module and a remote/ folder", async () => {
    await expect(generate({ "index.tsx": PAGE, "remote.ts": "", "remote/bar.ts": "" })).rejects.toThrow("has both a remote module and a remote/ folder - pick one.");
  });

  it("a module exporting Loading or Catch is imported statically", async () => {
    const out = await generate({ "index.tsx": PAGE, "(about).tsx": `${PAGE}\n${LOADING}`, "(help).tsx": `${PAGE}\n${CATCH}` });
    expect(out).toContain('import { Page as About, Loading as AboutLoading } from "../app/(about).tsx";');
    expect(out).toContain('import { Page as Help, Catch as HelpCatch } from "../app/(help).tsx";');
    expect(out).not.toContain("import(");
  });

  it("a nested Layout and NotFound load with their page", async () => {
    const out = await generate({ "index.tsx": PAGE, "blog/index.tsx": `${PAGE}\n${LAYOUT}\n${NOTFOUND}`, "blog/[slug].tsx": PAGE });
    expect(out).toContain('const BlogLayout = () => import("../app/blog/index.tsx").then(m => m.Layout);');
    expect(out).toContain('const BlogNotFound = () => import("../app/blog/index.tsx").then(m => m.NotFound);');
  });

  it("default entry hook rides as the `enter` prop on a leaf", async () => {
    const out = await generate({ "index.tsx": PAGE, "(admin).tsx": `${PAGE}\n${ENTER}` });
    expect(out).toContain('const AdminEnter = route => import("../app/(admin).tsx").then(m => m.default(route));');
    expect(out).toContain('<Route to="admin" as={Admin} enter={AdminEnter} />');
  });

  it("default entry hook gates a section (rides on the scope)", async () => {
    const out = await generate({ "admin/index.tsx": `${PAGE}\n${LAYOUT}\n${ENTER}`, "admin/[id].tsx": PAGE });
    expect(out).toContain('const AdminEnter = route => import("../app/admin/index.tsx").then(m => m.default(route));');
    expect(out).toMatch(/<Route to="admin" as={AdminLayout} enter={AdminEnter}>/);
  });

  it("a module with a default loads on first entry", async () => {
    const out = await generate({ "index.tsx": PAGE, "(account).tsx": `${PAGE}\n${SCOPE}` });
    expect(out).toContain('const AccountScope = () => import("../app/(account).tsx").then(m => m.default);');
    expect(out).toContain('const Account = () => import("../app/(account).tsx").then(m => m.Page);');
  });

  it("the root's default stays a static import", async () => {
    const out = await generate({ "index.tsx": `${PAGE}\n${ENTER}` });
    expect(out).toContain('import RootEnter, { Page as Root } from "../app/index.tsx";');
  });

  it("a default class renders around the route's content", async () => {
    const out = await generate({ "index.tsx": PAGE, "account/index.tsx": `${PAGE}\n${SCOPE}`, "account/[id].tsx": PAGE });
    expect(out).toMatch(/<Route to="account" as={AccountScope}>\s*<Route as={Account} \/>/);
    expect(out).not.toContain("enter={AccountScope}");
  });

  it("a default class wraps the Layout", async () => {
    const out = await generate({ "index.tsx": PAGE, "account/index.tsx": `${PAGE}\n${LAYOUT}\n${SCOPE}` });
    expect(out).toContain("const AccountScoped = props => <AccountScope><AccountLayout {...props} /></AccountScope>;");
    expect(out).toMatch(/<Route to="account" as={AccountScoped}>/);
  });

  it("will declare nested wrappers innermost first, and none for a scope with nothing to render", async () => {
    const out = await generate({
      "index.tsx": `${PAGE}\n${LAYOUT}\n${SCOPE}`,
      "account/index.tsx": `${PAGE}\n${LAYOUT}\n${SCOPE}`,
      "account/settings/index.tsx": `${PAGE}\n${LAYOUT}\n${SCOPE}`,
      "void/index.tsx": `${LAYOUT}\n${SCOPE}`,
    });
    const wrappers = out.split("\n").filter(line => line.includes("props =>")).map(line => line.split(" ")[1]);

    expect(wrappers).toEqual(["AccountSettingsScoped", "AccountScoped", "RootScoped"]);
  });

  it("a default class makes a lone page a scope", async () => {
    const out = await generate({ "index.tsx": PAGE, "(settings).tsx": `${PAGE}\nclass Panel extends State {}\nexport { Panel as default }` });
    expect(out).toMatch(/<Route to="settings" as={SettingsScope}>\s*<Route as={Settings} \/>/);
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

describe("app/ routing (scope)", () => {
  browserRouter();

  it("provides a default State to the layout and pages while the route is matched", async () => {
    const lives: string[] = [];

    class Session extends State {
      user = "ada";
      protected new() {
        lives.push("new");
        return () => lives.push("gone");
      }
    }

    const Shell = (props: { children?: any }) => <div data-shell>{Session.get().user}:{props.children}</div>;
    const Scoped = (props: { children?: any }) => <Session><Shell {...props} /></Session>;
    const Account = () => <span>{Session.get().user}</span>;
    const Home = () => <span>home</span>;

    const Tree = () => (
      <Route>
        <Route as={Home} />
        <Route to="account" as={Scoped}>
          <Route as={Account} />
        </Route>
      </Route>
    );

    location("/account");
    const root = await mount(Tree);

    expect(root.querySelector("[data-shell]")?.textContent).toBe("ada:ada");
    expect(lives).toEqual(["new"]);

    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();

    expect(root.textContent).toBe("home");
    expect(lives).toEqual(["new", "gone"]);
  });

  it("provides a default class loaded on demand", async () => {
    class Session extends State {
      user = "ada";
    }

    const Scope = () => Promise.resolve({ default: Session }).then(m => m.default);
    const Account = () => <span>{Session.get().user}</span>;

    const Tree = () => (
      <Route>
        <Route to="account" as={Scope} fallback={null}>
          <Route as={Account} fallback={null} />
        </Route>
      </Route>
    );

    location("/account");
    const root = await mount(Tree);
    await settle();
    expect(root.textContent).toBe("ada");
  });

  it("renders a Component default as the layout", async () => {
    class Frame extends Component {
      render(props: { children?: any }) {
        return <section data-frame>{props.children}</section>;
      }
    }

    const Tree = () => (
      <Route>
        <Route to="x" as={Frame}>
          <Route as={() => <span>inside</span>} />
        </Route>
      </Route>
    );

    location("/x");
    const root = await mount(Tree);
    expect(root.querySelector("[data-frame]")?.textContent).toBe("inside");
  });
});

describe("remote modules", () => {
  const appDir = join(tmpdir(), "app");
  const at = (path: string) => {
    const remote = remoteOf(appDir, join(appDir, path));
    return remote && [remote.pattern, remote.module, remote.folder.slice(appDir.length)];
  };

  it("will find a folder's remote module with its route pattern", () => {
    expect(at("remote.ts")).toEqual([[], "", ""]);
    expect(at("blog/[slug]/remote.ts")).toEqual([["blog", ":slug"], "", "/blog/[slug]"]);
    expect(at("(about)/remote.mts")).toEqual([["about"], "", "/(about)"]);
    expect(at("docs/[...]/remote.js")).toEqual([["docs", "*"], "", "/docs/[...]"]);
  });

  it("will give every module in a remote/ folder its parent's pattern", () => {
    expect(at("blog/remote/index.ts")).toEqual([["blog"], "", "/blog"]);
    expect(at("blog/remote/bar.ts")).toEqual([["blog"], "bar", "/blog"]);
    expect(at("blog/remote/bar/baz.ts")).toEqual([["blog"], "bar/baz", "/blog"]);
    expect(at("blog/remote/bar/index.ts")).toEqual([["blog"], "bar", "/blog"]);
  });

  it("will not take other modules, or files outside app/, as remote", () => {
    expect(at("blog/index.tsx")).toBeUndefined();
    expect(at("blog/remote.spec.ts")).toBeUndefined();
    expect(at("blog/remote/view.tsx")).toBeUndefined();
    expect(remoteOf(appDir, join(tmpdir(), "remote.ts"))).toBeUndefined();
  });
});
