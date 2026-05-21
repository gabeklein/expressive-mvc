# `@expressive/router` - Design & Implementation Plan

> Portable plan. Intended initial home: `expressive-state` (mvc) monorepo as `packages/router`. Long-term home: `expressive-ui` (alongside Form, Dialog, etc.). Nothing in the design assumes either location.

## Goal

A client-side router built on `Component` from `@expressive/state`. Declarative route trees expressed in JSX, page Components defined separately. Iterates toward React Router parity for app-dev use; not intended for distribution from this repo.

Non-goals (v1):

- SSR / streaming.
- Server-side route definitions / file-based discovery. That belongs to dev tooling (`expressive-dev`), which consumes this router.
- Loader / action API as a router-owned concept. Data loading is the page Component's job - see "Lifecycle and data loading" below.

## Shape at a glance

```tsx
import { Router, Route, Link } from '@expressive/router';
import { Home, Post, BlogLayout, BlogIndex, BlogPost, NotFound } from './pages';

function App() {
  return (
    <Router>
      <Route to="/" as={Home} />
      <Route to="/posts/:id" as={Post} />
      <Route to="/blog/*" as={BlogLayout}>
        <Route as={BlogIndex} />
        <Route to=":slug" as={BlogPost} />
      </Route>
      <Route to="*" as={NotFound} />
    </Router>
  );
}
```

Routes are declarative. Page Components (`Home`, `Post`, etc.) are plain Components defined separately - reusable, testable in isolation, no Route inheritance required. The Route tree is glanceable in one place.

## MVP cut

Floor required to render two pages and navigate between them. Everything else is incremental.

1. `matchPattern(pattern, path)` - literal segments + `:param` only. ~15 lines.
2. `Router extends Component` - `path` field, popstate listener, `goto(to)`. No search yet. ~25 lines.
3. `Route extends Component` - `to` + `as` props, `match` getter, parent-driven resolution picks one winner to mount. No nesting, no layouts. ~25 lines.
4. `Link extends Component` - click -> `goto`, respect modifiers + middle-click. Relative paths (`./x`, `../x`) resolve against the nearest Route. ~25 lines.
5. `Redirect extends Component` - mounts, calls `goto`, renders null. Optional `if` prop. ~10 lines.
6. **Default update-in-place, opt-in remount via `fresh`** - Routes reconcile their mounted page across same-pattern navigations by default. `<Route ... fresh />` keys the page by pathname for "fresh instance per URL" semantics. See "Lifecycle and data loading" below.

Roughly 150 LOC. Build an app on it, then iterate.

## Iteration order toward parity

Each step independent, ships green tests before the next begins.

1. **Search params** - `search` field on Router (raw string), `query` getter returns `URLSearchParams`. Consumers: `const { query } = Router.get()`.
2. **Nested routes / layouts** - `parent = get(Route, false)`, `base` getter, layout pattern (`to="/x/*"` + children Routes resolved into `as`'s `children` prop).
3. **Index route** - `<Route as={X} />` with no `to` matches parent's base path exactly.
4. **404 / catch-all** - `to="*"` falls through when no sibling claims the path.
5. **`redirect()` / `notFound()` sentinels** - throw, caught by nearest `Route.catch`.
6. **`NavLink`** - subclass with active-class support.
7. **Scroll restoration** - one Component subclass listening for navigation.
8. **Hash / memory Router** - alternate `Router` subclasses.

## Why Component is the substrate

`Component` provides almost every routing primitive:

| Routing need                       | Component feature                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Nested layouts                     | Component children passthrough + auto context provider                     |
| Access current route from anywhere | `get(Router)` / `get(Route)`                                               |
| Per-route loading state            | `fallback` field + Suspense placement                                      |
| Per-route error UI                 | `catch()`                                                                  |
| Per-route data fetching            | page's choice: `set(async)` once + `<Route fresh />` for per-URL, or in-place updates reacting to `params`         |
| Downstream child collection        | `get(Route, true)` for resolver                                            |

The router is therefore very small: a `Router` Component that owns location, a `Route` Component that matches a pattern and mounts a page Component, a `Link` Component for navigation. No external router runtime to write. No bespoke Suspense/error machinery.

Component is React-coupled (Suspense + ErrorBoundary integration). Making it renderer-agnostic is a separate, harder problem and not on the router's critical path. The router depends on Component as-is; if Component later becomes renderer-agnostic, the router inherits that for free.

## Lifecycle and data loading

**Default: update-in-place, React-idiomatic.**

When the URL changes within the same matched Route (e.g. `/posts/foo` -> `/posts/bar`), the Route does **not** unmount its page Component. React reconciles in place: same Component type, new props, `params` reactive on access. Ephemeral UI state (scroll, expanded sections, partially-filled forms), running animations, and live subscriptions all survive. This matches React idioms and what React Router devs expect.

Pages can read params reactively and decide for themselves how (or whether) to respond:

```tsx
class Post extends Component {
  route = get(Route);

  // Note: params is reactive. Reading route.params.id makes this Component
  // re-render when the path changes, but the instance persists.
  render() {
    return <article>id: {this.route.params.id}</article>;
  }
}
```

**Route is data-loading-agnostic.** It only owns match + lifecycle + optional `fallback`. Async behavior, caching, prefetching, refetch-on-param-change, websocket subscriptions - all page concerns. The Expressive Component context makes prefetching and caches very ergonomic, so any async behavior in a page deserves deliberate authorship rather than implicit "remount-resets-everything" magic.

### Opt-in remount via `fresh`

For pages that *want* "fresh instance per URL" semantics - typically because they use one-shot `set(async)` for URL-scoped data - opt into remount on the Route:

```tsx
<Route to="/posts/:id" as={Post} fresh />
```

`fresh` adds `key={pathname}` to the mounted page, so any URL change within the matching pattern unmounts + remounts. `set(async)` re-resolves, `new()` re-runs, instance state starts fresh.

```tsx
class Post extends Component {
  route = get(Route);
  fallback = <Skeleton />;

  // Runs once per mount. With `fresh`, that's once per URL.
  post = set(async () =>
    fetch(`/api/posts/${this.route.params.id}`).then(r => r.json())
  );

  catch(err: Error) {
    this.fallback = <ErrorView error={err} />;
  }

  render() {
    return <article>{this.post.body}</article>;
  }
}
```

Different-pattern navigations (e.g. `/posts/1` -> `/users/2`) always change the matched Route, so `as` is a different Component type and React mounts the new one. The `fresh` flag only affects same-pattern, different-params transitions.

### Reactive params

`params` is exposed as a getter on Route. Reading `route.params.x` makes the consumer reactive to `router.path` (and through it, to navigation). The getter memoizes per match so identity is stable across re-renders with unchanged params - safe to use in `useEffect` deps or `===` checks.

`params` returns *only* the captures from this Route's own pattern. For ancestor captures, read them off the ancestor Route explicitly (`SomeAncestorRoute.get().params`). This keeps ownership clean and avoids surprise unions; a convenience union getter can be added later if it proves common.

**Render contract:** Routes never gate themselves on `this.match`. Gating is structural - the parent (Router, or a layout Route) selects the matching child via downstream resolution and mounts only the winner. A Route's render is only ever invoked when it matched.

Implementation note: `Route.render` returns `<Page>{children}</Page>` by default. With `fresh`, it returns `<Page key={pathname}>{children}</Page>`. Tests should cover both modes: default update-in-place preserves the instance across same-pattern navigation; `fresh` produces a new instance per URL.

## Public API

```ts
import { Router, Route, Link, Redirect, redirect, notFound } from '@expressive/router';
```

No freestanding hooks. `Router.get()` and `Route.get($ => ...)` from `@expressive/state` cover every access pattern hooks would wrap.

### `Router`

Headless Component (no `render`). Owns `path` + `search` as reactive state. Listens to `popstate`. Exposes `goto(to, { replace })`. Provides itself to context. History API by default; `HashRouter` / `MemoryRouter` are future subclasses (no separate `BrowserRouter` rename).

```ts
export class Router extends Component {
  path = window.location.pathname;
  search = window.location.search;

  get query() {
    return new URLSearchParams(this.search);
  }

  protected new() {
    const sync = () => {
      this.path = window.location.pathname;
      this.search = window.location.search;
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }

  goto(to: string, replace = false) {
    const url = new URL(to, location.origin);
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    this.path = url.pathname;
    this.search = url.search;
  }
}
```

Children pass through; tree under `<Router>` is read by the resolver to find Routes.

### `Route`

Matches a pattern and mounts a page Component. Pages are plain Components passed via `as`. Layouts are Components that render `{children}` - the Route injects the resolved child mount as `children`.

```ts
export class Route extends Component {
  to = '';                       // omit for index route at parent base
  as: ComponentType = null!;     // required: the Component to mount when matched

  router = get(Router);
  parent = get(Route, false);

  get base(): string {
    return this.parent ? this.parent.base + this.parent.segment : '';
  }

  get segment(): string {
    return stripParams(this.to);
  }

  get match() {
    return matchPattern(this.base + this.to, this.router.path);
  }

  get params(): Record<string, string> {
    return this.match?.params ?? {};
  }

  // Anchor for relative navigation. Strips `:params` (substituted in) and `/*` (dropped).
  get anchor(): string {
    return resolveSegment(this.base + this.to, this.params) + '/';
  }

  goto(to: string, replace = false) {
    const resolved = to.startsWith('/')
      ? to
      : new URL(to, location.origin + this.anchor).pathname;
    this.router.goto(resolved, replace);
  }

  fresh = false; // opt-in: remount on every URL change within the matching pattern

  // Only invoked when this Route is the winner.
  render(props: { children?: ReactNode }) {
    const Page = this.as;
    return (
      <Page key={this.fresh ? this.router.path : undefined}>
        {props.children}
      </Page>
    );
  }
}
```

Usage:

```tsx
// Leaf: no nested Routes, `as` is the page.
<Route to="/posts/:id" as={Post} />

// Layout: nested Routes, `as` is the chrome Component that renders {children}.
// The Route resolves its child Routes and injects the winner as `as`'s children.
<Route to="/blog/*" as={BlogLayout}>
  <Route as={BlogIndex} />
  <Route to=":slug" as={BlogPost} />
</Route>

// Index route (no `to`) - matches parent base exactly.
<Route as={Dashboard} />
```

The layout chrome:

```tsx
const BlogLayout = (props: { children: ReactNode }) => (
  <section>
    <BlogNav />
    {props.children}
  </section>
);
```

No subclassing of `Route` is required in normal use. The advanced escape hatch - subclassing for typed identity per route - is described in "Future shape" below.

### Navigation (`goto`)

Both `Router` and `Route` expose `goto(to, replace?)`. They differ in how relative paths resolve:

- `Router.get().goto(to)` - `to` must be absolute. Relative paths (`./x`, `../x`) currently rejected; there's no Route context to anchor against.
- `Route.get().goto(to)` - absolute `to` passes through to the Router. Relative `to` resolves against the Route's `anchor` (its resolved path), then delegates to the Router.

```ts
// Inside a page Component nested under <Route to="/posts/:id">:
const { goto } = Route.get();
goto('./edit'); // /posts/foo + './edit'  -> /posts/foo/edit
goto('../'); // -> /posts/
goto('/login'); // -> /login (absolute, pass-through)
```

Anchor rules:

- Leaf Route `to="/posts/:id"` matched at `/posts/foo` -> anchor `/posts/foo/`.
- Layout Route `to="/blog/*"` -> anchor `/blog/` (the `/*` is "matches my children," not part of the layout's own location; the layout doesn't claim the catch-all).
- Index Route (no `to`) -> anchor inherits parent's anchor.

Decided semantics (directory anchor):

- `./x` and bare `x` are equivalent. Anything not starting with `/` is relative; resolved against the current Route's anchor as a directory.
- Trailing slashes on user input are normalized (`./edit` and `./edit/` are equivalent), matching the matcher's behavior.
- Empty path / `.` is a no-op (stays at current path, no remount). Use explicit `goto(current)` if you want a remount.
- Query string and hash from the current URL are _not_ preserved across navigation. To carry them forward, include them explicitly in the `to`.

`<Link>` reads `goto` from the nearest Route (or Router at the top level), so its `to` follows the same relative-resolution rules. Its rendered `<a href>` carries the _resolved absolute_ path so right-click / cmd-click / SEO work correctly.

### `Link`

Component handling pushState navigation while preserving native semantics (meta/ctrl click, middle click).

```ts
export class Link extends Component {
  to = '';
  replace = false;
  private route = get(Route, false);
  private router = get(Router);

  private go = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    (this.route ?? this.router).goto(this.to, this.replace);
  };

  render(props = {} as { children: ReactNode; className?: string }) {
    return (
      <a href={this.to} onClick={this.go} className={props.className}>
        {props.children}
      </a>
    );
  }
}
```

Subclassable for `NavLink` (active-state class), `PrefetchLink`, etc.

### `Redirect`

Declarative navigation. Mounts, calls `goto`, renders nothing. Optional `if` prop gates whether the redirect fires at all.

```ts
export class Redirect extends Component {
  to = '';
  replace = false;
  if?: boolean;   // when defined, redirect only fires if truthy
  private route = get(Route, false);
  private router = get(Router);

  protected new() {
    if (this.if === false) return;
    (this.route ?? this.router).goto(this.to, this.replace);
  }

  render() {
    return null;
  }
}
```

Usage:

```tsx
// Unconditional redirect (e.g. legacy URL alias)
<Redirect to="/new-home" />

// Conditional - reads naturally as a render-time guard
if (!user) return <Redirect to="/login" />;

// Or inline conditional via the if prop
<Redirect to="/login" if={!user} />
```

Relative paths follow the same anchor rules as `goto`/`Link` (resolved against the nearest Route).

### Imperative helpers

```ts
export function redirect(to: string, replace?: boolean): never;
export function notFound(): never;
```

Throw sentinel errors caught by the nearest `Route.catch()`, which sets fallback or calls `goto`. Detail TBD during implementation; keep behavior unsurprising.

## Pattern matching

Hand-rolled. Rules:

- `/foo/bar` - literal segments
- `/blog/:slug` - named param, single segment
- `/files/*` - catch-all, matches remainder (empty string allowed), always captured as `params['*']`
- `''` (empty `to`) - matches parent base exactly (index route)
- `'*'` - matches anything; useful as the not-found catch-all
- Trailing slashes are normalized (treated as equivalent)
- Case-insensitive matching of literal segments (configurable later if needed)
- Match returns `{ params: Record<string, string> } | null`

Implementation: split both pattern and path on `/`, walk in lockstep, collect params. `*` consumes the rest into `params['*']`. Roughly 30 lines.

`(group)` segments in patterns are stripped during normalization - they exist only in route nesting (file-based codegen concern), not in URL space.

## Resolution

Routes don't gate themselves. The parent decides who mounts:

- The `Router` collects its top-level child Routes via `get(Route, true)` (limited to direct Route descendants - not transitive across layouts).
- On every location change, the Router runs one resolver pass: of its child Routes, which matches? The most-specific match wins (more literal segments > catch-all). Only the winner is mounted.
- A layout Route does the same for its own children: when _it_ mounts, it resolves its child Routes against the current path and passes the winner to `as` as `children`.

This is also the 404 strategy: a `<Route to="*" as={NotFound} />` is just the catch-all the resolver falls back to when no specific sibling matches.

Specificity ordering (most-specific first):

1. Exact literal match
2. `:param` segments
3. `*` (catch-all)

Ties at the same level break by document order (first-declared wins). Decide during implementation if this should warn on ambiguity.

## Package layout (in mvc)

```
packages/router/
  src/
    index.ts          # public exports
    matcher.ts        # matchPattern + helpers, pure, no JSX
    router.ts         # Router Component
    route.ts          # Route Component + resolver
    link.ts           # Link Component
    redirect.ts       # Redirect Component + redirect / notFound sentinels
    matcher.test.ts
    router.test.tsx
    route.test.tsx
    link.test.tsx
  package.json
  tsconfig.json
  vitest.config.ts    # if needed beyond root
```

Match mvc's existing package conventions (pnpm workspace entry, root tsconfig extension, `tsc --noEmit && vitest run --coverage`, 100% coverage target). Tests use the shared `vitest` re-export and custom matchers (`toHaveUpdated`).

## Testing

Vitest + jsdom (same as mvc react package). Coverage target 100% per mvc policy.

Cases to cover:

- Matcher: literal, params, catch-all, multi-segment, trailing-slash normalization, no-match, empty path, root pattern.
- Router: initial path, `goto` push, `goto` replace, popstate, search query reactivity.
- Route `goto`: absolute paths pass through; `./x` resolves against the Route's anchor; `../x` walks up; non-Route context (called on Router directly) rejects relative paths.
- Route resolution: most-specific wins; document order breaks ties; only the winner mounts.
- Route props: `to` + `as` mount the page when matched; `params` reactive on access; nested `base` composition.
- Index route: `<Route as={X} />` matches parent base exactly, not sub-paths.
- Catch-all: `to="*"` mounts when no sibling matches.
- Update-in-place default: navigating to a new param value within the same pattern preserves the page instance; `route.params` reflects new values reactively.
- `fresh` opt-in: with `<Route fresh />`, same-pattern param change unmounts and remounts the page; `set(async)` re-resolves.
- Layout: `to="/x/*"` matches prefix, mounts `as` with `children` set to the resolved child Route mount; doesn't mount when out of prefix.
- Link: pushes history, prevents default, respects modifier keys, respects middle-click.
- Redirect: fires `goto` on mount, renders null, respects `replace`, `if={false}` suppresses navigation, relative paths resolve through nearest Route.
- Suspense: page with `set(async ...)` shows fallback then content.
- Error: page `catch()` shows fallback, retries on resolve.
- StrictMode: double-mount produces single Router instance, listeners cleaned up.

Each test should fail without the relevant implementation - per mvc policy, don't write tests that pass for the wrong reason.

## Out of scope (explicit)

- SSR / streaming / `renderToPipeableStream` integration.
- Router-owned loader / action API.
- File-based routing codegen (lives in `expressive-dev`).
- Server-side route definitions.
- View transitions API.
- Route-level metadata / `<head>` management (separate concern; may live in expressive-ui).
- Inline JSX siblings of nested Routes (e.g. headers/footers between Route children of a layout). Layout chrome lives in the `as` Component instead.
- Distribution from this repo - this router exists for feedback-driven dev work on `@expressive/state`.

## Future shape: Route subclassing for typed identity

`<Route to="" as={X} />` covers the common case but loses some typing leverage that subclassing would provide. A possible later extension:

```ts
class PostRoute extends Route {
  to = '/posts/:id';
  as = Post;
  declare params: { id: string };
}

// Then in the tree:
<PostRoute />

// And a typed Link:
<Link to={PostRoute} params={{ id: '1' }} />
```

This trades JSX brevity for class-as-destination typing. Defer until either (a) the type story actively pays off in real apps built on the declarative form, or (b) a meaningful behavior difference between leaf and layout Routes emerges that needs a class to express.

## Rejected designs

Decisions worth recording so they don't get relitigated:

- **URL-spec relative-path anchor.** `./x` from `/blog/post-1` resolving to `/blog/x` (browser/HTML semantics, where `post-1` is treated as a "file") was considered. Rejected because the most common routing pattern - "edit / comments / settings views of the current resource" - has no clean expression: you'd need `goto(\`./${slug}/edit\`)`, `goto('post-1/edit')` (caller knows the slug), or `goto(\`/blog/${slug}/edit\`)` (verbose absolute). Directory anchor wins.
- **Multi-match resolution.** Allowing multiple sibling Routes to match the same URL simultaneously (parallel routing / compositional UI from route declarations) was considered. Rejected because (a) the same outputs are reachable via a layout's `as` Component, which is the natural home for shared chrome in a Component-based system, (b) multi-match complicates resolution and requires either positional rendering or an explicit Outlet primitive, both of which hurt predictability, (c) the orthogonal patterns it'd enable (persistent modals, command palettes, drawers) are state-not-routing concerns and belong in Components reading `get(Router)`. Single-winner-per-level stands.
- **`exact` prop on `Route`.** Redundant with index-route syntax (no `to`) under single-winner resolution. Skipped.
- **Magic `true` as preserve-flag in a query-params arg to `goto`.** E.g. `goto('./edit', { ref: true, page: '2' })` meaning "preserve current `ref`, set `page` to 2." Rejected because `true` is itself a legitimate query value (`?admin=true` is real), making `{ admin: true }` ambiguous: preserve current `admin` or set it to the string `"true"`? Any sugar in this space should use an explicit sentinel or function form (`goto(to, q => ({ ...q, page: '2' }))`). Left as Open Question instead of committed API.

1. **Relative paths at the Router level.** `Router.get().goto('./x')` currently rejected (no Route to anchor against). Wary of the gap but holding for now; if a real use case shows up (a global handler wanting "this page's neighborhood" semantics from outside any Route), revisit - could resolve against `router.path` as a directory.
2. **`goto` second-arg expansion.** Currently `goto(to, replace?: boolean)` - tight, matches `<Link replace />`. Deferred opts that might warrant migrating to `goto(to, opts: { replace, ... })`:
   - **Query sugar** - preserve-all flag, replace-with-object, or transform-fn. Tepidly wanted; not blocking. Build strings yourself for now.
   - **`history.state` payload.** Open question whether this is even needed. With update-in-place as default, instance state persists across same-pattern navigations naturally - reducing the need for `history.state` as a workaround. For state that should survive back/forward across *different* patterns (scroll restoration, modal stack), a Router-scoped Component that snapshots per-pathname and restores on `popstate` would handle it in user-space. Revisit if a use case shows the Component approach is insufficient.
   - **Scroll control** (`preventScrollReset`, etc.) and **view transitions** - speculative; tied to features not yet on the roadmap.

   Migration when needed: `goto(x, true)` -> `goto(x, { replace: true })`. Mechanical, IDE-friendly, JSX `<Link>` props unchanged.

3. **`Link` style API.** Just `className`, or also `activeClassName` via a `NavLink` subclass? Defer to v1.1.
4. **Programmatic navigation outside Components.** Currently requires `Router.get()` from a Component context. Should there be a module-level `goto()` that finds the active Router? Probably no - keep router instance-scoped.
5. **`fresh` keying granularity.** When `fresh` is set, key on full pathname vs only on the params relevant to this Route's pattern? Pathname is simpler and almost always equivalent; revisit if a use case needs finer control (e.g. ignoring query for keying purposes).
6. **Typed `to` strings.** `<Link to="/posts/:id" />` could grow a template-literal type extracting required params. Defer; nice-to-have, not blocking.
7. **Structural remount-boundaries.** `fresh` covers leaf-level "remount per URL." If a use case appears for "this *subtree* is a remount unit, including ancestors" (e.g. resetting a whole nested layout on tab switch), a structural form - perhaps an anonymous Route layer or a `fresh` flag on a layout - could express it. Not needed today.

## Long-term home

When `expressive-ui` is established, `packages/router/` lifts directly out of mvc with no changes. Its only mvc dependency is `@expressive/state` (and its renderer adapters), which it would depend on from expressive-ui as a published package anyway.
