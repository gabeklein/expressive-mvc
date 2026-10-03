// @vitest-environment happy-dom
// @vitest-environment-options { "url": "http://localhost/" }

import { Component, State } from "@expressive/mvc";
import { Link, Redirect } from "@expressive/router";
import { afterEach, describe, expect, it } from "vitest";

import { browserRouter, location, mount, settle } from "../../test.setup";
import { Route } from ".";

function Boom(): any {
  throw new Error("kaboom");
}
function Err({ error, retry }: { error: Error; retry: () => void }) {
  return <button onClick={retry}>caught: {error.message}</button>;
}

const click = (root: Element, label: string) => {
  const target = Array.from(root.querySelectorAll("a, button")).find(el => el.textContent === label);
  if (!target) throw new Error(`No control labelled "${label}"`);
  (target as HTMLElement).click();
  return settle();
};

it("renders page content when nothing throws", async () => {
  class Home extends Route {
    render() {
      return <span>home</span>;
    }
  }

  const root = await mount(Home);
  expect(root.textContent).toBe("home");
});

it("renders the Catch UI when a child throws", async () => {
  class Crashing extends Route {
    Catch = Err;
    render() {
      return <Boom />;
    }
  }

  const root = await mount(Crashing);
  expect(root.textContent).toBe("caught: kaboom");
});

it("recovers when retry is invoked and the error has cleared", async () => {
  let boom = true;
  function MaybeThrows() {
    if (boom) throw new Error("kaboom");
    return <span>recovered</span>;
  }

  class Crashing extends Route {
    Catch = Err;
    render() {
      return <MaybeThrows />;
    }
  }

  const root = await mount(Crashing);
  expect(root.textContent).toBe("caught: kaboom");

  boom = false;
  await click(root, "caught: kaboom");

  expect(root.textContent).toBe("recovered");
});

it("bubbles to an ancestor Catch when the throwing Page has none", async () => {
  class Inner extends Route {
    render() {
      return <Boom />;
    }
  }
  class Outer extends Route {
    Catch = Err;
    render() {
      return <Inner />;
    }
  }

  const root = await mount(Outer);
  expect(root.textContent).toBe("caught: kaboom");
});

// The `NotFound` member injects a to-less `none` child via the `children` seam,
// so unmatched URLs resolve to it without a generator-emitted sibling Route.
describe("NotFound member", () => {
  browserRouter();

  const Home = () => <span>home</span>;
  const Missing = () => <span>missing</span>;

  const Tree = () => (
    <Route NotFound={Missing}>
      <Route as={Home} />
    </Route>
  );

  it("matched URL renders the lexical child", async () => {
    location("/");
    expect((await mount(Tree)).textContent).toBe("home");
  });

  it("unmatched URL falls through to the injected NotFound", async () => {
    location("/nope");
    expect((await mount(Tree)).textContent).toBe("missing");
  });
});

// A user-authored page (`export class Page extends Route`) passed to the generated
// outer node's `as`. The inner Route delegates: it becomes the scope arbiter and sees
// the outer's computed `children` (incl. injected NotFound).
describe("user Page delegated via `as`", () => {
  browserRouter();

  const Child = () => <p>child</p>;
  const Missing = () => <p>missing</p>;

  class UserPage extends Route {
    render() {
      return <section data-user>{this.children}</section>;
    }
  }

  const Tree = () => (
    <Route as={UserPage} NotFound={Missing}>
      <Route to="sub" as={Child} />
    </Route>
  );

  it("inner renders its own chrome and owns the matched child", async () => {
    location("/sub");
    const root = await mount(Tree);
    expect(root.querySelector("[data-user]")?.textContent).toBe("child");
  });

  it("sees the outer's injected NotFound (outer children flows into inner)", async () => {
    location("/nope");
    const root = await mount(Tree);
    expect(root.querySelector("[data-user]")?.textContent).toBe("missing");
  });

  it("resolves the user class identity via .get()", async () => {
    let resolved: unknown;
    const Probe = () => { resolved = UserPage.get(); return null; };
    const T = () => (
      <Route as={UserPage}>
        <Route to="x" as={Probe} />
      </Route>
    );

    location("/x");
    await mount(T);

    expect(resolved).toBeInstanceOf(UserPage);
  });
});

// Routes the filesystem can't spell - computed from data at runtime. A `children`
// override maps a collection to child routes, composing `super.children` so the
// generated index/NotFound still apply.
describe("dynamically generated routes", () => {
  browserRouter();

  const SECTIONS = ["alpha", "beta"];

  class DocsPage extends Route {
    protected get children() {
      return (
        <>
          {super.children}
          {SECTIONS.map(slug => (
            <Route key={slug} to={slug} as={() => <article>doc:{slug}</article>} />
          ))}
        </>
      );
    }
  }

  const Tree = () => (
    <Route>
      <Route to="docs" as={DocsPage} NotFound={() => <p>missing</p>}>
        <Route as={() => <p>docs-index</p>} />
      </Route>
    </Route>
  );

  it("exact scope renders the (composed) index", async () => {
    location("/docs");
    expect((await mount(Tree)).textContent).toBe("docs-index");
  });

  it("each computed slug resolves to its generated route", async () => {
    location("/docs/beta");
    expect((await mount(Tree)).textContent).toBe("doc:beta");
  });

  it("a slug outside the collection falls through to NotFound", async () => {
    location("/docs/gamma");
    expect((await mount(Tree)).textContent).toBe("missing");
  });
});

// Auth gate: a guard Page protects its subtree, redirecting unauthenticated access.
describe("route guard / auth gate", () => {
  browserRouter();

  let authed = false;
  afterEach(() => { authed = false; });

  const Secret = () => <p>secret</p>;
  const Login = () => <p>login</p>;

  class Guard extends Route {
    render() {
      return authed ? <>{this.children}</> : <Redirect to="/login" replace />;
    }
  }

  const Tree = () => (
    <Route>
      <Route to="login" as={Login} />
      <Route to="admin" as={Guard}>
        <Route as={Secret} />
      </Route>
    </Route>
  );

  it("redirects unauthenticated access away from the protected scope", async () => {
    location("/admin");
    const root = await mount(Tree);
    expect(root.textContent).toBe("login");
  });

  it("renders the protected content once authenticated", async () => {
    authed = true;
    location("/admin");
    const root = await mount(Tree);
    expect(root.textContent).toBe("secret");
  });
});

// The generated form of the guard: a verdict function rides as the Route `redirect` prop.
describe("redirect guard prop", () => {
  browserRouter();

  const Secret = () => <p>secret</p>;
  const Login = () => <p>login</p>;
  const Missing = () => <p>missing</p>;

  it("string verdict redirects away", async () => {
    const Tree = () => (
      <Route>
        <Route to="login" as={Login} />
        <Route to="admin" as={Secret} redirect={() => "/login"} />
      </Route>
    );
    location("/admin");
    expect((await mount(Tree)).textContent).toBe("login");
  });

  it("falsy verdict allows normal render", async () => {
    const Tree = () => (
      <Route>
        <Route to="admin" as={Secret} redirect={() => undefined} />
      </Route>
    );
    location("/admin");
    expect((await mount(Tree)).textContent).toBe("secret");
  });

  it("null verdict force-404s to the section NotFound (no navigation)", async () => {
    const Tree = () => (
      <Route NotFound={Missing}>
        <Route to="admin" as={Secret} redirect={() => null} />
      </Route>
    );
    location("/admin");
    expect((await mount(Tree)).textContent).toBe("missing");
    expect(window.location.pathname).toBe("/admin");
  });
});

// The `default` entry hook rides as the `enter` prop; our Route bridges it to the
// router's `redirect` slot, passing the Route as the hook's arg.
describe("default entry hook via `enter` (route arg)", () => {
  browserRouter();

  const Secret = () => <p>secret</p>;
  const Login = () => <p>login</p>;

  it("hook receives its Route as the arg, reads params, allows on falsy", async () => {
    const seen: { argId?: string } = {};
    const hook = (route: Route) => {
      seen.argId = route.match?.id;
    };
    const Tree = () => (
      <Route>
        <Route to=":id" as={Secret} enter={hook} />
      </Route>
    );

    location("/ok");
    const root = await mount(Tree);

    expect(seen.argId).toBe("ok");
    expect(root.textContent).toBe("secret");
  });

  it("verdict derived from params redirects", async () => {
    const hook = (route: Route) => (route.match?.id === "block" ? "/login" : undefined);
    const Tree = () => (
      <Route>
        <Route to="login" as={Login} />
        <Route to=":id" as={Secret} enter={hook} />
      </Route>
    );

    location("/block");
    expect((await mount(Tree)).textContent).toBe("login");
  });
});

describe("nav cycle: async guard <-> class Page", () => {
  browserRouter();

  let caught = "";

  const Layout = (p: { children?: any }) => (
    <main>
      <nav><Link to="/blog/hello">Hello</Link> | <Link to="/admin">Admin</Link></nav>
      {p.children}
    </main>
  );
  const Boundary = ({ error }: { error: Error; retry: () => void }) => { caught = error.message; return <p>broke</p>; };
  const BlogIndex = () => <h1>blog index</h1>;
  class BlogSlug extends Route { render() { return <h1>post {this.match!.slug}</h1>; } }
  const Admin = () => <h1>admin area</h1>;
  const guard = async () => { await Promise.resolve(); return undefined; };

  const Tree = () => (
    <Route as={Layout} Catch={Boundary}>
      <Route to="blog">
        <Route as={BlogIndex} />
        <Route to=":slug" as={BlogSlug} />
      </Route>
      <Route to="admin" as={Admin} redirect={guard} />
    </Route>
  );

  it("survives admin → /blog/hello → admin → /blog/hello", async () => {
    location("/admin");
    const root = await mount(Tree);
    for (const label of ["Hello", "Admin", "Hello"]) await click(root, label);

    expect(caught).toBe("");
    expect(root.querySelector("h1")?.textContent).toBe("post hello");
  });
});

describe("scope: a default-exported class", () => {
  browserRouter();

  it("provides a State to the layout and the page while the route is matched", async () => {
    const lives: string[] = [];

    class Session extends State {
      user = "ada";
      protected new() {
        lives.push("new");
        return () => lives.push("gone");
      }
    }

    const Shell = (props: { children?: any }) => {
      const { user } = Session.get();
      return <div data-shell>{user}:{props.children}</div>;
    };
    const Page = () => <span>{Session.get().user}</span>;
    const Home = () => <span>home</span>;

    const Tree = () => (
      <Route>
        <Route as={Home} />
        <Route to="account" as={Shell} scope={Session}>
          <Route as={Page} />
        </Route>
        <Route to="elsewhere" as={() => <Link to="/account">go</Link>} />
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

  it("uses a Component class as the layout when none is set", async () => {
    class Frame extends Component {
      render(props: { children?: any }) {
        return <section data-frame>{props.children}</section>;
      }
    }
    const Page = () => <span>inside</span>;

    const Tree = () => (
      <Route>
        <Route to="x" scope={Frame}>
          <Route as={Page} />
        </Route>
      </Route>
    );

    location("/x");
    const root = await mount(Tree);
    expect(root.querySelector("[data-frame]")?.textContent).toBe("inside");
  });
});

describe("loaders", () => {
  browserRouter();

  it("renders a page whose module loads on demand", async () => {
    const Page = () => <span>loaded</span>;
    const Lazy = () => Promise.resolve({ Page }).then(m => m.Page);

    const Tree = () => (
      <Route>
        <Route to="lazy" as={Lazy} fallback={<span>waiting</span>} />
      </Route>
    );

    location("/lazy");
    const root = await mount(Tree);
    await settle();
    expect(root.textContent).toBe("loaded");
  });
});
