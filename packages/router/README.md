<h1 align="center">@expressive/router</h1>

<p align="center">
  Class-based declarative router built on Expressive MVC.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/router"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Frouter.svg"></a>
</p>

---

A host-agnostic router for [Expressive MVC](https://github.com/gabeklein/expressive-mvc). Routes are declared as nested JSX, matching is computed lexically from that tree (not a separate config), and navigation state lives on a reactive `Router` any component can read or drive.

```bash
npm install @expressive/router @expressive/react react
```

## Declaring routes

Routes nest to mirror the URL. `to` is the pattern segment, `as` is the page (or layout) component. A layout receives its matched children via `children`.

```tsx
import '@expressive/react'; // registers the host adapter
import { BrowserRouter, Route } from '@expressive/router';

<BrowserRouter>
  <Route as={RootLayout}>
    <Route as={HomePage} /> {/* index - matches the parent path */}
    <Route to="blog" as={BlogLayout}>
      <Route as={BlogIndex} /> {/* /blog */}
      <Route to=":slug" as={BlogPost} /> {/* /blog/:slug */}
    </Route>
    <Route to="login" redirect="/" /> {/* matched -> redirects */}
    <Route none as={NotFound} /> {/* no sibling matched */}
  </Route>
</BrowserRouter>;
```

| Prop             | Meaning                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `to`             | URL segment. `:name` captures a param, `*` is a catch-all. Omit for an index route.        |
| `as`             | Component rendered when matched (as a layout, receives `children`).                        |
| `none`           | Matches when no sibling did - scoped to its parent (root = app 404, nested = section 404). |
| `redirect`       | When matched, redirect here instead of rendering.                                          |
| `label` / `meta` | Display name / free-form metadata for nav and breadcrumbs (ignored by matching).           |

Siblings competing for the same slot arbitrate **first-match by declaration order**. Without an ancestor `Router`, a `<Route>` spins up a headless in-memory one; `BrowserRouter` binds to the address bar.

## Reading the match

A page reads the nearest `Route` from context with `get()` and uses its reactive getters:

```tsx
import { Route } from '@expressive/router';

const BlogPost = () => {
  const { match } = Route.get(); // nearest Route in context; subscribes
  return <article>post: {match!.slug}</article>;
};
```

Read `matched` (boolean) in render so same-pattern navigations (`/blog/a` → `/blog/b`) reconcile in place instead of remounting.

## Navigation state, query & fragments

`Router` exposes location as reactive `path`, `query`, `hash`, and derived `url`
surfaces. Query and fragment state round-trip through navigation and history.

```tsx
router.goto('/posts?page=2#comments'); // push
router.goto('/posts', true); // replace
router.url = '/posts?page=2#comments'; // assigning url navigates

router.query.get('page'); // read - subscribes to just this param
router.query.set('page', '2'); // write - pushes a new entry, like goto
router.query.delete('sort'); // delete - also navigates

router.hash; // '' or a leading-# string
router.hash = '#comments'; // pushes through the same settlement path

router.back(); // one entry back
router.go(-2); // move by an arbitrary history delta
```

The map is single-valued (`string` keys and values); repeated URL keys collapse
to the last value. URL-driven changes reconcile the same map in place. The hash
is an opaque, percent-encoded string. Fragment navigation does not scroll or
focus an element automatically.

`go(delta)` truncates finite fractional deltas to integer steps. Zero,
non-finite, and out-of-range deltas do nothing; it never uses `go(0)` as a
reload signal.

## Memory and nested routers

`Router` is navigation state, not an address-bar abstraction. Its path-like
locations also work for native apps, tabs, wizards, modal flows, and other UI
with no public URL.

Nest Routes for one address space. Nest a Router only when a UI region needs an
independent location and history. Use `<Router>` directly for a one-off region;
subclass it when the route set or navigation policy is reusable:

```tsx
class PanelRouter extends Router {
  path = '/profile';

  select(to: string) {
    this.goto(to, true); // selection, not a growing visit history
  }

  render() {
    return (
      <>
        <Route to="profile" as={ProfileTab} />
        <Route to="security" as={SecurityTab} />
      </>
    );
  }
}

<BrowserRouter>
  <Route to="settings" as={PanelRouter} />
</BrowserRouter>;
```

No `global` declaration is needed: the outer context claims the instance. A
standalone `.new()` call instead requires the subclass to choose a root policy.

The outer Route matches `/settings`; the private Router navigates among
`/profile` and `/security` without changing that browser URL. Its internal
Routes are invisible to the outer lexical matcher and resolve the nearer
Router. Navigation never changes or implicitly bubbles to the outer one.

Direct Route siblings are enough here. Wrap them in a root Route only when that
scope provides shared `as` layout, a local `none`, nested paths, or a NavLinks
tree.

Build behavior from `Router` rather than selecting a specialized router type:
tabs usually replace the current location; wizards usually push steps and use
`back()`. Keep workflow data and validation in a domain State.

Ownership controls lifetime. A Route-owned `PanelRouter` resets when remounted.
To preserve its location and history, store `panel = new PanelRouter()` on a
longer-lived State or Component and render that owned instance. Use explicit
child composition when the placement must configure `path`:

```tsx
<Route to="settings"><PanelRouter path="/security" /></Route>
```

Use a headless Router inside `BrowserRouter`; nesting `BrowserRouter` would make
both instances compete for the same browser address and History API.

A top-level Route creates a fallback headless Router only when none exists
upstream. That convenience does not isolate a Route beneath an existing Router.

## Suspense and navigation settlement

Routes are Suspense boundaries. Pass `fallback` for cold load and use a lazy
page normally:

```tsx
const Post = lazy(() => import('./Post'));

<Route to="posts/:id" fallback={<Spinner />} as={Post} />;
```

In-app navigation runs through protected `Router.navigate(work)`, whose default
uses the host transition scheduler. If the next page or entry guard suspends,
the current screen remains visible until the next one is ready. Cold load still
renders `fallback`.

`router.navigating` remains true through presentation. Read it beside or around
the routed content; overlapping navigation is latest-wins, so superseded work
cannot later change the page, history, or status. For app-driven browser
navigation, the address is written after the screen settles. Browser
Back/Forward and external History API calls necessarily change it first.

Override `navigate(work)` on a Router subclass to stage presentation
differently. Status and ordering wrap the seam, so the override need only run
and settle `work`.

## Links

`Link` renders an `<a>` that navigates internal targets on plain left-click.
Modifier/middle clicks, non-`_self` targets, downloads, and scheme-bearing or
protocol-relative targets remain browser-owned. It exposes its own match state,
so active styling needs no separate component:

```tsx
import { Link } from '@expressive/router';

<Link to="blog">Blog</Link>
<Link to="/posts?page=2" replace>Page 2</Link>
<Link to="https://example.com/docs">External docs</Link>
```

```tsx
// active links by subclassing - read `active` / `match`
class NavLink extends Link {
  render() {
    return (
      <a
        href={this.href}
        onClick={this.go}
        className={this.active ? 'active' : undefined}
        aria-current={this.active ? 'page' : undefined}>
        {this.props.children}
      </a>
    );
  }
}
```

## Redirect

`Redirect` navigates to `to` when mounted, gated on `when` (default `true`), and renders nothing. The `Route` `redirect` prop is an always-replace shorthand for it.

```tsx
import { Redirect } from '@expressive/router';

<Redirect to="/login" when={!user} />     {/* navigates on mount when `when` is true */}
<Redirect to="/home" replace />           {/* overwrite the current entry */}
```

`Route.redirect` also accepts a synchronous or async entry guard. A non-empty
string redirects with replacement, a falsy value allows the route, and `null`
cedes the path to the nearest scoped `none` Route:

```tsx
<Route
  to="admin"
  fallback={<Spinner />}
  redirect={async () => (session.authorize() ? undefined : '/login')}
  as={Admin}
/>
```

The router coordinates navigation, not application data. Keep fetching,
mutations, caches, and request cancellation in the route/page State; async
fields suspend through the Route boundary.

## Generated navigation

`NavLinks` renders a navigation tree from the route hierarchy - it walks the declared routes and emits links automatically. Its rendering is built from PascalCase **subcomponents** you override to shape the output:

| Member  | Renders                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- |
| `Item`  | A single link (defaults to a `Link` using the route's `label`).                                 |
| `List`  | The container wrapping a level of items.                                                        |
| `Group` | A nested section; transparent by default - override to turn route nesting into headed sections. |

```tsx
import { NavLinks } from '@expressive/router';

class SideNav extends NavLinks {
  List = (props) => <ul className="side">{props.children}</ul>;
  Group = (props) => (
    <section>
      <h3>{props.route.label}</h3>
      {props.children}
    </section>
  );
}
```

These members are overridable reactive subcomponents bound to the live instance - the same model `Component` provides, via [render composition](https://github.com/gabeklein/expressive-mvc/blob/main/packages/react/README.md#render-composition) and [subcomponents](https://github.com/gabeklein/expressive-mvc/blob/main/packages/react/README.md#subcomponents).

## Runtime boundaries

- `Router` is headless and keeps in-memory history - use it for tests and
  non-browser hosts.
- `BrowserRouter` binds the browser address and History API.
- Server rendering does not share a global router between requests, but the
  package is not an SSR routing/data/hydration system.
- React Native can use `Router`; `BrowserRouter`, `Link`, and `NavLinks` are
  browser/DOM-facing.

The supported location model is pathname, single-valued query parameters, and
an opaque fragment. Basename mounting, arbitrary history state, automatic
scroll-to-anchor, scroll restoration, navigation blocking, and data-router APIs
are not currently built in.

---

Routes are plain `@expressive/mvc` Components, so they render under any Expressive host adapter.

Full guide and examples → **[expressive.dev/docs/guides/router](https://expressive.dev/docs/guides/router)**

## License

MIT
