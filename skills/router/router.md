# Router

Read [production.md](production.md) when choosing a router, integrating async
page data, testing browser behavior, or checking the supported URL/host
boundary.

Runnable source: the [`router`](https://expressive.dev/examples/router/overview) section - [`overview`](https://expressive.dev/examples/router/overview), [`params`](https://expressive.dev/examples/router/params), [`query`](https://expressive.dev/examples/router/query), [`guards`](https://expressive.dev/examples/router/guards), [`transitions`](https://expressive.dev/examples/router/transitions), [`nav`](https://expressive.dev/examples/router/nav). Complete programs, served as HTML.

Routes are nested JSX, matched lexically from the tree (no config); navigation state is a reactive `Router` State any component can read or drive.

```bash
npm install @expressive/router @expressive/react react
```

```tsx
import { Route, Link, NavLinks, Redirect, Router, BrowserRouter } from '@expressive/router';
```

## Mental model

- **`Router`** - the navigation State: current `path`, reactive `query`/`hash`, derived `url`, and an in-memory history stack. Headless; touches no browser globals, so it runs and tests anywhere. It is also the memory-router substrate.
- **`BrowserRouter`** - binds the core to `window.location`/`history`, syncing `path`/`query`/`hash` on navigation (`goto`, `popstate`, `hashchange`, external `pushState`/`replaceState`).
- **`Route`** - a `Component` that matches part of the URL and renders a page. Routes nest to mirror the URL hierarchy. Each `Route` is a scoped facade over the active `Router` (`path`, `match`, `query`, `goto`, `resolve`).
- **`Link` / `NavLinks` / `Redirect`** - navigation UI built on `Route`.

A `<Route>` with no ancestor `Router` in context spins up a headless `Router`. For a browser app, provide a `BrowserRouter` so navigation reflects the address bar.

## Declaring routes

Routes are nested JSX. `to` is the pattern segment; `as` is the page (or layout) component. Children compose against the parent's path.

```tsx
<Route as={RootLayout}>
  <Route as={HomePage} />                {/* index: matches the parent path */}
  <Route to="blog" as={BlogLayout}>
    <Route as={BlogIndex} />             {/* /blog */}
    <Route to=":slug" as={BlogPost} />   {/* /blog/:slug */}
  </Route>
  <Route none as={NotFound} />        {/* no sibling matched */}
</Route>
```

| Prop       | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `to`       | URL pattern segment. `:name` captures a param. A trailing `*` is a catch-all matching the remaining path segments (captured as `*`) - needed on a **leaf** that should match deep paths; **redundant on a scope with child Routes**, whose children already extend the match. Omit for an index route. |
| `as`       | Component rendered when matched. As a layout, it receives matched children via `children`. |
| `none`     | Matches when nothing else in this scope did. Scoped to its parent (root-level = app 404, nested = section 404). |
| `redirect` | Entry guard. A static string redirects there when matched; a function gates the route (see [Entry guards](#entry-guards)). |
| `label`    | Display name for NavLinks/breadcrumbs/titles (ignored by matching).                      |
| `meta`     | Free-form metadata (icons, ordering, badges) - ignored by matching.                      |

A parent-less `<Route>` with no `to` is its own root: always matched, capturing everything below.

### Flat leaf vs. nested scope

A multi-segment `to` (`to="users/:id"`) is a **flat leaf** - it does *not* synthesize an intermediate `users` scope. Nesting is the explicit (and only) way to open one:

```tsx
<Route to="users/:id" as={Detail} />            {/* flat leaf */}

<Route to="users" as={Layout}>                   {/* nested scope */}
  <Route to=":id" as={Detail} />
  <Route none as={NotFound} />
</Route>
```

Both resolve `/users/42` identically - same match, same captures, same relative navigation (both anchor on the resolved `/users/42`). Nesting changes nothing for plain navigation; it buys a **scope**. Only the nested form can:

- host a **section `none` Route** (a `/users/<bad-id>` 404 that stays in the section, rather than falling through to the app-level none Route);
- wrap children in **shared chrome** (the layout `as`) that persists across param changes;
- interpose a **section `Route`** in context (so `get(Route)` sees both the section and the leaf) and group the section in `NavLinks`.

A `none` Route always needs an authored parent scope - a root-level one is the app 404 only because the root `<Route>` is its scope. So **use the flat leaf for a standalone endpoint; nest the moment you need a section 404, shared chrome, sibling routes under the prefix, or nav grouping** - which is most resource pages, and is required for the force-404 pattern below.

## Entry guards

`redirect` accepts a **function** as well as a static string - an entry guard run when the route is matched (it can wrap a section by living on a `Route` with children). The verdict drives one of three outcomes:

| Returns | Outcome |
| --- | --- |
| a truthy `string` | redirect there (replaces history) |
| `''` / `undefined` | allow normal render |
| `null` | **force-404**: cede the path so the scope falls through to its nearest `none` Route |

The guard takes no arguments - read state from the declaring class. It may be **async**: while it pends, cold load shows `fallback`; in-app navigation holds the current screen ([Deferred presentation](#deferred-presentation)).

The verdict is cached per concrete path of the route's own pattern: navigation below it reuses the verdict; re-entry or a change to its own params (`/document/1` -> `/document/2` on `document/:id`) re-runs the guard.

```tsx
class Documents extends Component {
  session = new Session();
  router = new Router();

  async vet() {
    if (!this.session.user) return '/login';
    const res = await fetch(`/api${this.router.path}`);
    if (!res.ok) return null;   // forbidden and missing look the same
  }

  render() {
    return (
      <Route to="document">
        <Route to=":id" redirect={this.vet} fallback={<Spinner />} as={Document} />
        <Route none as={DocumentNotFound} />
      </Route>
    );
  }
}
```

Force-404 marks only the declined URL; navigating elsewhere clears it. `null` means "definitively not here" - a falsy `&&` short-circuit allows. It cedes to the nearest authored `none`, so a section 404 needs a nested scope; a flat leaf falls through to the app one.

## Code-split pages

`as` takes a lazy component - `React.lazy`, or anything that suspends while its module loads. A `Route` is its own suspense boundary: on cold load `fallback` shows while the chunk loads, then the page resolves in place - the Route instance, its `match`, and any ancestor layout survive. On in-app navigation the previous screen holds instead (see [Deferred presentation](#deferred-presentation)).

```tsx
const Document = lazy(() => import('./Document'));

<Route to="document/:id" fallback={<Spinner />} as={Document} />
```

A lazy *layout* suspends its whole scope - child routes register only after its module resolves. Navigating away mid-load abandons the page; it never mounts. A failed chunk is an error, not a suspension - handle it with `catch` on a `Route` subclass, or it propagates to the nearest ancestor boundary.

## Deferred presentation

Every navigation (`goto`, `Link`, query writes, `back`/`go`, popstate) commits through `Router.navigate`, non-urgent by default (React `startTransition`). Navigating to a page that isn't ready - loading chunk, pending guard - holds the current screen instead of flashing `fallback`; cold load still shows `fallback`. For `goto`, `Link`, and query writes, `BrowserRouter` writes the address once the new screen is on. Back/forward and external History API calls change the address first, so the old screen may linger under the new address.

Override `navigate(work)` on a subclass to stage the swap differently - `work` applies the navigation state and must run:

```ts
class MyRouter extends BrowserRouter {
  static global = true;   // subclasses re-declare global explicitly

  protected navigate(work: () => void) {
    // bracket the swap (e.g. View Transitions), then defer as usual
    return super.navigate(work);
  }
}
```

Navigation status and ordering wrap this seam; the override need not call `super`. If navigations overlap, only the latest may commit history or clear `navigating`. Initial browser synchronization does not count as navigation.

`router.navigating` is true from the call until the new screen is on. Read it beside the outgoing content or from a wrapper around it - a component which reads it *and* rebuilds the deferred content renders that content against the path already written, forfeiting the hold.

```tsx
const Bar = () => <div className="bar" data-busy={MyRouter.get().navigating || undefined} />;
```

Hosts whose subscribers carry no scheduler apply navigation at normal priority - same timing as before the seam.

## Reading match state inside a page

A page reads the nearest `Route` from context - `Route.get()` in an FC, `get(Route)` on a class:

```tsx
const BlogPost = () => {
  const { match } = Route.get();
  return <article>post: {match!.slug}</article>;
};
```

| Member            | Type                              | Meaning                                                                 |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `route.match`     | `Record<string,string> \| undefined` | Captured params from the current match (`undefined` when unmatched). Stable identity across reads when captures are unchanged. |
| `route.matched`   | `boolean`                         | Whether this route is active. Read this in render (not `match`) so same-pattern navigations reconcile in place instead of remounting. |
| `route.path`      | `string`                          | This route's own absolute path (base + segment).                        |
| `route.query`     | `map.Insert<string,string>`       | Live query map from the active Router (global, not route-scoped - see below). |
| `route.anchor`    | `string`                          | Directory-style anchor for relative navigation.                         |
| `route.goto(to)`  | -                                 | Navigate. A string resolves relative to this route; a params object swaps route params in place (see below). |
| `route.resolve(to)` | `string`                        | Resolve a (possibly relative) url to an absolute pathname.              |
| `route.parent`    | `Route \| undefined`              | Nearest ancestor Route.                                                 |
| `route.inner`     | `Route[]`                         | Registered child Routes, declaration order. Filter on `label` for step lists and progress. |
| `route.active`    | `Route \| undefined \| null`      | Matched child (`null` if ambiguous). Read through a proxy, so compare by `path`, not identity. |
| `route.matches`   | `string[]`                        | Paths of matched children.                                              |

Same-pattern navigation (`/blog/a` -> `/blog/b`) keeps the page instance mounted: `matched` is unchanged, so the component reconciles and re-reads `match`, rather than unmounting/remounting.

To swap a param without composing a relative path, pass `goto` an object: it rebuilds this route's path from the current match merged with the overrides. Any param the route **declares in its own `to`** can change - position doesn't matter.

```tsx
// on /document/123, route pattern "document/:id"
route.goto({ id: '456' });        // -> /document/456

// on /a/1/2, route pattern "a/:b/:c"
route.goto({ c: '9' });           // -> /a/1/9   (keeps :b)
route.goto({ b: '8' });           // -> /a/8/2   (keeps :c)
```

**A route can only set the params it declares.** Inherited (ancestor) segments are filled from the current path, read-only; a key the route does not own throws. This is where flat-vs-nested matters again: a flat `org/:orgId/user/:userId` leaf owns *both*, but in `<Route to="org/:orgId"><Route to="user/:userId"/></Route>` the inner leaf owns only `userId` - changing `orgId` is the parent scope's call. To cross levels, navigate to the owning route or pass an absolute path string. A declared param the current path can't supply and the object doesn't provide throws an unresolved-parameters error.

Param changes do not remount: like `query`, `match` updates reactively and the page reconciles in place. A param combination that matches the pattern but is invalid in data (`/org/9/user/2` where that pairing doesn't exist) navigates fine; detecting it is the page's job - see force-404 under [Entry guards](#entry-guards).

## Navigation state on `Router`

`Router` (and `BrowserRouter`) expose the canonical location as four reactive surfaces:

| Member               | Type                        | Notes                                                                    |
| -------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `path`               | `string`                    | Pathname only.                                                           |
| `query`              | `map.Insert<string,string>` | Canonical query state - a reactive map (see below).                      |
| `hash`               | `string`                    | Opaque fragment: `''` or a leading-`#` string. Assigning navigates.      |
| `url`                | `string`                    | Full path + query + fragment, canonically serialized. Assigning navigates. |
| `goto(to, replace?)` | -                           | Navigate; `replace` overwrites the current entry instead of pushing.    |
| `back()`               | -                           | Move back one history entry.                                             |
| `go(delta)`            | -                           | Move by a relative history delta.                                        |

```tsx
router.goto('/posts?page=2#comments'); // push
router.goto('/posts', true);    // replace
router.url = '/posts?page=2#comments'; // same as goto (push)
router.hash = '#comments';      // preserves path/query and pushes
router.back();
router.go(-2);
```

`go` truncates finite fractional deltas to integer steps. Zero, non-finite,
and out-of-range deltas do nothing; `go(0)` does not reload the document.

`hash` stays percent-encoded and is not parsed into structured state. Hash-only
targets such as `<Link to="#comments" />` preserve the current path and query.
Fragment navigation does not scroll or focus an element automatically.

## The `query` map

`query` is the canonical query state as a reactive `map` - not a string. Read a param to track it; **write** a param (or delete it) to navigate.

```tsx
router.query.get('page');       // read - subscribes to just this param
router.query.set('page', '2');  // write - pushes a new history entry, like goto
router.query.delete('sort');    // delete - also navigates
```

Writing, deleting, or clearing params pushes a new history entry through the same settlement path as `goto`. URL-driven changes (navigation, popstate) reconcile the same map, so consumers reading `query.get('foo')` re-render only when that param changes.

Notes:
- Keys and values are `string` - URL params carry no other type. Reading an absent key is `undefined`.
- Single-valued: repeated keys (`?a=1&a=2`) collapse to the last value.
- `query` is **global** to the Router. On a `Route` it is the same map for every route, unlike `match` which is that route's own captures. (Query strings are not path-scoped.)
- `url` is always canonically serialized (space as `+`, last-value-per-key), so navigation never pushes a spurious duplicate entry due to encoding differences. Query mutations preserve `hash`.

## Links and navigation UI

### `Link`

Renders an `<a>` that navigates internal targets on click. Modifier/middle
clicks, non-`_self` targets, downloads, and scheme-bearing or protocol-relative
targets stay browser-owned. Internal `href` values are resolved to absolute
paths.

```tsx
<Link to="blog">Blog</Link>
<Link to="/posts?page=2" replace>Page 2</Link>
<Link to="https://example.com/docs">External docs</Link>
```

| Prop      | Meaning                                                  |
| --------- | -------------------------------------------------------- |
| `to`      | Target, resolved relative to the enclosing `Route`.      |
| `replace` | Replace the current history entry instead of pushing.    |
| ...rest   | Forwarded to the underlying `<a>`.                       |

`Link` also exposes its match state as reactive getters, so active-link styling needs no separate component:

| Getter   | Type                        | Meaning                                                            |
| -------- | --------------------------- | ------------------------------------------------------------------ |
| `href`   | `string`                    | Resolved absolute path for the `<a>`.                              |
| `match`  | `boolean \| undefined`      | `true` exact match, `false` prefix match, `undefined` no match.    |
| `active` | `boolean`                   | Whether the current path matches the target at all (`match !== undefined`). |

Both `match`/`active` are **lazy**: a `Link` whose render reads neither stays inert across navigation (no re-render on route changes). Reading either subscribes that instance to navigation.

#### Active links by subclassing

There is no `NavLink` - extend `Link` and read `active`/`match` to express activeness however the host wants (a `className` on web, a `style` on native). A subclass that authors its own `render` **fully replaces** the base anchor rather than nesting inside it (see render composition in the Component skill): the base detects subclass-authored content and defers. `route` and `go` are `protected` so the subclass can wire its own anchor.

> **Publishing a host-agnostic package** (built on `@expressive/mvc`, no adapter): annotate every overridden `render` as `: Component.Node`. Unannotated, the `.d.ts` emitter bakes the adapter-less fallback type in, and the subclass fails JSX checks for consumers. Invisible inside a monorepo that maps to source.

```tsx
class NavLink extends Link {
  render() {
    return (
      <a href={this.href} onClick={this.go}
         className={this.active ? 'active' : undefined}
         aria-current={this.active ? 'page' : undefined}>
        {this.props.children}
      </a>
    );
  }
}
```

### `NavLinks`

Renders a navigation tree from the route hierarchy. Subclass and override `Item`, `List`, and `Group` to control rendering - `Group` is transparent by default (flattens), override it to turn tree structure into nav sections with headings.

```tsx
class SideNav extends NavLinks {
  List = (p) => <ul className="side">{p.children}</ul>;
  Group = (p) => <section><h3>{p.route.label}</h3>{p.children}</section>;
}
```

### `Redirect`

Navigates to `to` on mount when `when` (default `true`). Pushes unless `replace`. Renders nothing. A string `redirect` prop on `Route` is the always-replace shorthand.

```tsx
<Redirect to="/login" when={!user} />
<Redirect to="/home" replace />
```

## Extending Route: contributing child routes

Override `protected get children()` to add, remove, or reorder a scope's child routes, composing on `super.children` (the JSX children). Matching, registration, `none` resolution, and render all read the result, as if declared.

```tsx
class Page extends Route {
  None = NotFound;

  protected get children(): Component.Node {
    return <>{super.children}<Route none as={this.None} /></>;
  }
}
```

`<Page to="docs/*">…</Page>` now falls back to `None` with no caller-written 404. Generating routes from data uses the same seam:

```tsx
class Examples extends Route {
  modules = set<Modules>();

  protected get children(): Component.Node {
    return <>
      {organize(this.modules).map((group) => (
        <Route key={group.slug} to={group.slug} label={group.label}>
          {group.items.map((item) => (
            <Route key={item.slug} to={item.slug} as={item.page} />
          ))}
        </Route>
      ))}
      {super.children}
    </>;
  }
}

<BrowserRouter><Examples modules={modules} as={Shell} /></BrowserRouter>
```

Omit `super.children` and caller-passed children (e.g. a `<Route none>`) are dropped.

- **Own scope only.** Outside walks - sibling `as` arbitration, a parent recursing into this element's JSX - see only the JSX, like class-field `to` below.
- A contributed `none` turns a leaf into a see-through scope (prefix match).
- Contribute in `children`, never `render()` - matching reads it without rendering.

## Lexical matching - the limits

Matching is computed statically from the JSX tree in the same render. It does **not** see:
- class-field `to` on `Route` subclasses (only the JSX `to` prop), or
- routes declared inside a child component's own render (the `*`-delegation case).

A see-through scope matches when a descendant does, or when it owns a `none` Route - which claims everything under its path. Without one it is never a greedy prefix. So a later sibling under a section with a 404 is unreachable, and the router **throws** on that shape: declare it above the section or inside it.
