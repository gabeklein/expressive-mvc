# Router

`@expressive/router` is a host-agnostic, class-based router built on Expressive MVC. Routes are declared as nested JSX, matching is lexical (computed from the JSX tree, not a separate config), and navigation state lives on a reactive `Router` State that any component can read or drive.

```tsx
import { Route, Link, NavLinks, Redirect, Router, BrowserRouter } from '@expressive/router';
```

## Mental model

- **`Router`** - the navigation State: current `path`, reactive `query` record, derived `url`, and an in-memory history stack. Headless; touches no browser globals, so it runs and tests anywhere. It is also the memory-router substrate.
- **`BrowserRouter`** - binds the core to `window.location`/`history`, syncing `path`/`query` on navigation (`goto`, `popstate`, external `pushState`/`replaceState`).
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
  <Route default as={NotFound} />        {/* matches when no sibling did */}
</Route>
```

| Prop       | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `to`       | URL pattern segment. `:name` captures a param; `*` is a catch-all (delegated to children). Omit for an index route. |
| `as`       | Component rendered when matched. As a layout, it receives matched children via `children`. |
| `default`  | Matches when nothing else in this scope did. Scoped to its parent (root-level = app 404, nested = section 404). |
| `redirect` | When matched, redirect here instead of rendering (always replaces history).              |
| `label`    | Display name for NavLinks/breadcrumbs/titles (ignored by matching).                      |
| `meta`     | Free-form metadata (icons, ordering, badges) - ignored by matching.                      |

A parent-less `<Route>` with no `to` is its own root: always matched, capturing everything below.

## Reading match state inside a page

A page reads the nearest `Route` from context (e.g. via `Consumer` or `get(Route)`) and uses its reactive getters:

```tsx
const BlogPost = () => (
  <Consumer for={Route}>{route => <article>post: {route.match!.slug}</article>}</Consumer>
);
```

| Member            | Type                              | Meaning                                                                 |
| ----------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `route.match`     | `Record<string,string> \| undefined` | Captured params from the current match (`undefined` when unmatched). Stable identity across reads when captures are unchanged. |
| `route.matched`   | `boolean`                         | Whether this route is active. Read this in render (not `match`) so same-pattern navigations reconcile in place instead of remounting. |
| `route.path`      | `string`                          | This route's own absolute path (base + segment).                        |
| `route.query`     | `Record<string,string\|undefined>` | Live query record from the active Router (global, not route-scoped - see below). |
| `route.anchor`    | `string`                          | Directory-style anchor for relative navigation.                         |
| `route.goto(to)`  | -                                 | Navigate, resolving `to` relative to this route.                        |
| `route.resolve(to)` | `string`                        | Resolve a (possibly relative) url to an absolute pathname.              |

Same-pattern navigation (`/blog/a` -> `/blog/b`) keeps the page instance mounted: `matched` is unchanged, so the component reconciles and re-reads `match`, rather than unmounting/remounting.

## Navigation state on `Router`

`Router` (and `BrowserRouter`) expose the canonical location as three reactive surfaces:

| Member            | Type                                | Notes                                                                |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `path`            | `string`                            | Pathname only.                                                       |
| `query`           | `Record<string,string\|undefined>` | Canonical query state - a reactive record (see below).               |
| `url`             | `string`                            | Full URL (path + `?query`), canonically serialized. Assigning navigates. |
| `goto(to, replace?)` | -                                | Navigate to an absolute path; `replace` overwrites the current entry instead of pushing. |
| `back()` / `forward()` | -                              | Move the history cursor.                                             |

```tsx
router.goto('/posts?page=2');   // push
router.goto('/posts', true);    // replace
router.url = '/posts?page=2';   // same as goto (push); use goto(to, true) to replace
router.back();
```

## The `query` record

`query` is the canonical query state as a reactive record - not a string. Read a param to track it; **write** a param (or delete it) to navigate.

```tsx
router.query.page;          // read - subscribes to just this param
router.query.page = '2';    // write - pushes a new history entry, like goto
delete router.query.sort;   // delete - also navigates
```

Writing or deleting a param pushes a new history entry, exactly as if it arrived via `goto`. URL-driven changes (navigation, popstate) reconcile the same record, so consumers reading `query.foo` re-render only when that param changes.

Notes:
- Values are always `string | undefined` - URL params carry no other type. Reading an absent key is `undefined`.
- Single-valued: repeated keys (`?a=1&a=2`) collapse to the last value.
- `query` is **global** to the Router. On a `Route` it is the same record for every route, unlike `match` which is that route's own captures. (Query strings are not path-scoped.)
- `url` is always canonically serialized (space as `+`, last-value-per-key), so navigation never pushes a spurious duplicate entry due to encoding differences.

### Narrowing known params with `declare`

The default record accepts any string key. A subclass can declare the known params for autocomplete and typo safety - on both `Router` and `Route`:

```tsx
class Search extends Router {
  declare query: { q?: string; page?: string };
}

class SearchRoute extends Route {
  declare query: { q?: string; page?: string };
}
// query.q -> string | undefined; query.unknown -> compile error
```

Use `declare` (not a re-initializer) so it only retypes the inherited field. Keep declared values `string`-typed - there is no coercion, so `{ page: number }` would be a lie.

## Links and navigation UI

### `Link`

Renders an `<a>` that navigates on click (intercepting only plain left-clicks, so modifier/middle clicks fall through to the browser). `href` is the resolved absolute path.

```tsx
<Link to="blog">Blog</Link>
<Link to="/posts?page=2" replace>Page 2</Link>
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

> **Gotcha - annotate overridden `render` in agnostic packages.** When a host-agnostic package (router, or any package built against `@expressive/mvc` with no adapter in scope) ships its own `.d.ts`, give every overridden `render` an explicit `: Component.Node` return type:
> ```tsx
> render(props = {} as { children?: Component.Node }): Component.Node { ... }
> ```
> `Component.Node` is a deferred alias over the host seam - it resolves to the host's node type (e.g. `ReactNode`) only once an adapter augments `Host`. With no annotation, the `.d.ts` emitter resolves the alias at *build* time (no adapter present) and bakes the literal fallback into the published types; it never re-resolves in a consumer, so `<NavLink>` fails JSX validity. The explicit annotation makes the emitter preserve the alias *by reference* so it re-resolves per consumer. This never surfaces inside the monorepo, where path mapping reads source and re-infers - only against the built package.

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

Navigates to `to` when mounted, gated on `when` (default `true`). Pushes by default; pass `replace` to overwrite. Renders nothing. (The `Route` `redirect` prop is a always-replace shorthand for this.)

```tsx
<Redirect to="/login" when={!user} />
<Redirect to="/home" replace />
```

## Extending Route: contributing child routes

A `Route` subclass can opine on its own scope's children before matching and
registration by overriding the `protected get nested()` seam. It defaults to the
children declared in JSX; override it to return the effective set - add, remove,
or reorder - composing on `super.nested`. Both matching and render read the
result, so contributed routes participate in this scope's control flow
(matching, `inner` registration, default-resolution, `matches`, and render)
exactly as if declared in JSX.

```tsx
class Page extends Route {
  Default = NotFound;

  protected get nested(): Component.Node {
    return <>{super.nested}<Route default as={this.Default} /></>;
  }
}
```

`<Page to="docs/*">…</Page>` now resolves to `Default` whenever no child of the
scope matches - a section fallback the caller never had to write. `Default` is
the subclass's own surface; `Route` exposes only the `nested` seam.

Scope and caveats:
- **Own scope only.** Contributed routes are first-class *within this Route*.
  They are invisible to walks that inspect this Route as a bare JSX element from
  the outside - sibling `as`-slot arbitration and a parent scope recursing into
  this element's lexical children - which have no instance to read `nested` from.
  Same blind spot as class-field `to` (see below).
- **Classification follows effective children.** Contributing a default to a
  `to`-leaf turns it into a see-through scope (matched by prefix rather than
  exact pattern). Intended - the leaf/scope distinction reflects what the scope
  effectively contains.
- Contribute via `nested`, not `render()`: it is pure analysis (returns nodes,
  never runs a page render), so matching can consult it without the circularity
  and lazy-gate problems of deciding matches from render output.

## Lexical matching - the limits

Matching is computed statically from the JSX tree in the same render. It does **not** see:
- class-field `to` on `Route` subclasses (only the JSX `to` prop), or
- routes declared inside a child component's own render (the `*`-delegation case).

A see-through scope counts as matched only when a descendant matches - never as a greedy prefix. Put routes where they are lexically visible to the matcher.
