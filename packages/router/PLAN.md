# `@expressive/router` - Design & Status

> Permanent home: the `expressive-mvc` monorepo as `packages/router`. Router is the **C** in MVC and, once #106 lands its host-agnostic JSX pragma, depends only on `@expressive/mvc` (no host imports) - so the core repo is its sole upstream and there is no host-specific or standalone repo it could belong to instead. Admission rule for this repo: host-agnostic, authored against the `/mvc` pragma, public-API only. (`@expressive/dev` is a downstream *consumer* of router, not its home; router targets plain SPAs and must work without dev's runtime.)

## Goal

A client-side router built on `Component` from `@expressive/mvc`. Declarative route trees expressed in JSX, page Components defined separately. Iterates toward React Router parity for app-dev use; not intended for distribution from this repo.

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
      <Route as={NotFound} />
    </Router>
  );
}
```

Routes are declarative. Page Components are plain Components defined separately - reusable, testable in isolation, no Route inheritance required. The Route tree is glanceable in one place.

## Current status

The MVP and PLAN iteration steps 2-4 are implemented. The remaining work is the State-substrate conversion, the documented iteration steps 1 + 5-9, and a handful of nits.

### Landed

- **Matcher** (`url.ts`): literal segments, `:param`, trailing `*` catch-all, trailing-slash normalization, case-insensitive literals. Returns `{ params, score }` for specificity ordering.
- **Specificity scoring** lives in `url.ts` (literal=100, `:param`=10, catch-all=-1, pure-literal bonus +1) but the resolver currently arbitrates by **declaration order only** - the first matching sibling with `as` wins. Specificity-based arbitration is a pending iteration; users must declare more-specific routes before less-specific ones.
- **Router** (`router.ts`, `extends State`): `path` field, popstate listener, monkey-patches `history.pushState`/`replaceState` so programmatic navigation outside `goto` still syncs. Owns URL primitives: `match(base, to)` (reactive on `path`), `anchor(route)`, `resolve(route, url)`, `segment(to)`, `goto(to, replace?)` (absolute-only, throws on relative). Auto-spawned as a `Context.root` singleton on first Route mount; users can also provide an explicit instance via `<Provider for={Router}>`.
- **Route** (`route.ts`, `extends Component`): `to`, `as`, `parent = get(Route, false)`, derived `base`, `match`, `matched`, `anchor`, `resolve`, `goto`. Default `to='*'` (catch-all layout) - leaf-vs-layout default is contextual. Index routes are `to=''`. Independent rendering (no `cloneElement`, no `base` prop, no clones cache, no lexical inspection of JSX children). Routes self-render `null` when their pattern does not match. Sibling arbitration is bottom-up: a Route with `as` registers with its nearest parent Route on first render and yields to any earlier-registered sibling that also has `as` and matches. Passthrough Routes (no `as`) are grouping containers - they pass children through and never compete. Render and the sibling walk read `matched` (boolean) instead of `match` so same-pattern navigations don't re-render the Route - Expressive's computed properties only fire when the cached value changes, and `matched` stays `true` across `/posts/foo` -> `/posts/bar` (Consumers inside pick up new params reactively).
- **Router auto-spawn**: `router: Router = set(() => this.get(Router, false) || Router.new())` on Route. The `set()` factory runs lazily on first access (during Route's render), well after context wiring. Context lookup finds any explicitly-provided Router; otherwise `Router.new()` activates a fresh instance that lands in `Context.root` via the `register` fallback so subsequent Routes find it. `set()` is also load-bearing for reactivity - it makes `router` a managed Route property so cross-state reads (`router.path` from Route's render) wire subscriptions via the proxy machinery in [observable.ts:119-120](../mvc/src/observable.ts#L119-L120).
- **Link** (`link.ts`): `to`, `replace`, `href` getter (resolved absolute path), modifier/middle-click bailout. Requires Route in context (always available because Router provides one).
- **Redirect** (`redirect.ts`): fires `goto` in `new()` (StrictMode-safe). `when` prop gates whether navigation fires on mount.
- **Update-in-place**: Route renders `<Page>{children}</Page>` with no `key`, so same-pattern navigation reconciles in place; `params` updates reactively.
- **Acceptance tests** (`acceptance.test.tsx`) cover the nested file-routing tree: nested layouts (index + dynamic + catch-all sibling), `params` capture, instance preservation across same-pattern navigation.

### Pending - iteration

In rough order of priority:

1. **Search params**: `search` field on Router (raw string), `query` getter returns `URLSearchParams`. Sync in the same listener that syncs `path`.
2. **`redirect()` / `notFound()` sentinels**: throw, caught by nearest `Route.catch`. Sets fallback or calls `goto`.
3. **`NavLink`**: subclass of `Link` with active-class support.
4. **Scroll restoration**: one Component subclass listening for navigation events.
5. **`HashRouter` / `MemoryRouter`**: alternate Router subclasses (read URL from different sources). The Router-as-State conversion makes these cleaner.
6. **`Link.onClick`** (async pre-navigation hook): user-supplied handler that can cancel; exposes `pending: boolean` for in-flight state. Detailed sketch under "Nice-to-haves".
7. **Specificity-based arbitration**: feed `match.score` into the sibling walk so literal beats `:param` beats `*` regardless of declaration order. Currently first-match-wins.

### Pending - nits

- **`Route.params` reactive identity**: current implementation returns a fresh `match?.params ?? {}` on every read; downstream `useEffect` deps or `===` checks will see false positives. Memoize per match.

## Why Component is the substrate

`Component` provides almost every routing primitive:

| Routing need                       | Component feature                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Nested layouts                     | Component children passthrough + auto context provider                     |
| Access current route from anywhere | `get(Router)` / `get(Route)`                                               |
| Per-route loading state            | `fallback` field + Suspense placement                                      |
| Per-route error UI                 | `catch()`                                                                  |
| Per-route data fetching            | page's choice: `set(async)` once on mount, or in-place updates reacting to `params` |
| Downstream child collection        | `get(Route, true)` for resolver                                            |

Component is React-coupled (Suspense + ErrorBoundary integration). Making it renderer-agnostic is a separate, harder problem and not on the router's critical path.

## Lifecycle and data loading

**Default: update-in-place, React-idiomatic.**

When the URL changes within the same matched Route (e.g. `/posts/foo` -> `/posts/bar`), the Route does **not** unmount its page Component. React reconciles in place: same Component type, new props, `params` reactive on access. Ephemeral UI state (scroll, expanded sections, partially-filled forms), running animations, and live subscriptions all survive.

Pages can read params reactively and decide for themselves how (or whether) to respond:

```tsx
class Post extends Component {
  route = get(Route);

  render() {
    return <article>id: {this.route.params.id}</article>;
  }
}
```

**Route is data-loading-agnostic.** It owns match + lifecycle + optional `fallback`. Async behavior, caching, prefetching, refetch-on-param-change, websocket subscriptions - all page concerns.

Different-pattern navigations (e.g. `/posts/1` -> `/users/2`) always change the matched Route, so `as` is a different Component type and React mounts the new one. Same-pattern navigations keep the instance. An opt-in to force per-URL remount is documented in "Nice-to-haves".

### Reactive params

`params` is a getter on Route. Reading `route.params.x` makes the consumer reactive to `router.path` through `match`. `params` returns *only* captures from this Route's own pattern. For ancestor captures, read them off the ancestor Route explicitly. (Stable identity per match is a pending nit; see "Pending - nits".)

**Render contract:** Routes always render as normal Components. A Route returns `null` when its own pattern does not match. When it has both `as` and a parent Route, it also returns `null` if an earlier-declared sibling Route with `as` is currently matching. Passthrough Routes (no `as`) render their children when matched and never block siblings - structural elements (layouts, headers, sibling Routes) coexist freely under a passthrough container.

## Public API

```ts
import { Router, Route, Link, Redirect } from '@expressive/router';
// pending: redirect, notFound
```

No freestanding hooks. `Router.get()` and `Route.get($ => ...)` from `@expressive/mvc` cover every access pattern hooks would wrap.

### `Router`

`extends Component`. Owns `path` reactively. Listens to `popstate`; monkey-patches `history.pushState`/`replaceState` so programmatic navigation outside of `goto` (e.g. third-party libs) still syncs `path`. Renders a default catch-all `<Route>` so descendants always have a Route in context.

URL primitives live on Router rather than scattered across Route/Link/Redirect:

- `match(base, to)` - reactive on `path`; consumers track URL by calling this.
- `anchor(route)` - directory-style anchor for the given Route (substitutes `:params`, drops trailing `/*`).
- `resolve(route, url)` - resolves possibly-relative `url` against `route.anchor`.
- `segment(to)` - the "own" portion of a `to` for composition into child bases.
- `goto(to, replace?)` - absolute-only. Relative `to` throws (must go through a Route).

### `Route`

`extends Component`. Matches a pattern under its inherited base; mounts `as` when matched. Default `to='*'` (catch-all layout). Use `to=''` for index, `to='/abs/path'` for absolute, or relative segments to compose under a parent.

Routes render `as`/`children` directly when active, `null` when not. Child Routes mount as normal components (via React's tree) and discover their nearest Route ancestor through context, so nested Routes work transparently across structural wrappers (layouts, intermediate components, fragments). A parent Route arbitrates among its child Routes that declare `as`: the first matching sibling wins; later siblings with `as` render `null`. Passthrough Routes (no `as`) are grouping containers - they pass children through and never compete, which enables parallel route groups under one parent.

```tsx
<Route to="/posts/:id" as={Post} />

<Route to="/blog/*" as={BlogLayout}>
  <Route as={BlogIndex} />
  <Route to=":slug" as={BlogPost} />
</Route>

<Route as={Dashboard} />
```

Layout chrome is a plain Component:

```tsx
const BlogLayout = (props: { children: ReactNode }) => (
  <section>
    <BlogNav />
    {props.children}
  </section>
);
```

### Navigation (`goto`)

- `Router.get().goto(to)` - absolute only; throws on relative (no Route context to anchor against).
- `Route.get().goto(to)` - absolute passes through; relative resolves against this Route's `anchor`, then delegates to Router.

```ts
// Inside a page under <Route to="/posts/:id"> matched at /posts/foo:
const { goto } = Route.get();
goto('./edit');   // /posts/foo/edit
goto('../');      // /posts/
goto('/login');   // /login
```

Anchor rules:

- Leaf Route `to="/posts/:id"` at `/posts/foo` -> anchor `/posts/foo/`.
- Layout Route `to="/blog/*"` -> anchor `/blog/`. The `/*` is "matches my children," not part of the layout's own location.
- Index Route (no `to` / `to=""`) inherits parent anchor.

Decided semantics (directory anchor):

- `./x` and bare `x` are equivalent. Anything not starting with `/` is relative.
- Trailing slashes normalized.
- Empty path / `.` is a no-op.
- Query string and hash from the current URL are *not* preserved across navigation - include them explicitly in `to`.

`<Link>` uses the nearest Route's `goto` and renders `<a href>` with the resolved absolute path so right-click / cmd-click / SEO work.

### `Link`

```ts
export class Link extends Component {
  to = '';
  replace = false;
  // requires Route ancestor; Router provides a default one
}
```

Subclassable for `NavLink`, `PrefetchLink`, etc. (`NavLink` is pending.)

### `Redirect`

Fires `goto` in `new()` (StrictMode-safe). `when` gates whether navigation fires at mount; reactive flips of `when` after mount are *not* expected to fire (matches the "fires on mount" mental model).

```tsx
<Redirect to="/new-home" />
<Redirect to="/login" when={!user} />
if (!user) return <Redirect to="/login" />;
```

### Imperative helpers (pending)

```ts
export function redirect(to: string, replace?: boolean): never;
export function notFound(): never;
```

Throw sentinels caught by the nearest `Route.catch()`. Detail TBD during implementation.

## Pattern matching

Hand-rolled, lives in `url.ts`. Rules:

- `/foo/bar` - literal segments (case-insensitive)
- `/blog/:slug` - named param, single segment
- `/files/*` - catch-all, matches zero or more remaining segments, captured as `params['*']`
- `''` - matches parent base exactly (index)
- `'*'` - matches anything (default for Routes with children; useful as not-found)
- Trailing slashes normalized

Match returns `{ params, score } | null`. Score drives specificity ordering inside the resolver.

## Resolution

Bottom-up, in `Route.render`. Each Route registers itself with its nearest parent Route on first render (stored in a `WeakMap<Route, Route[]>` keyed by parent, child order = mount order = JSX declaration order). On render:

1. If `this.match` is falsy -> `null`.
2. If `this.as` is set and a parent Route exists, walk parent's children up to `this`. If any earlier sibling has both `.as` and `.match` truthy, return `null`.
3. Otherwise render `as ? createElement(as, {}, children) : children`.

Passthrough Routes (no `as`) skip step 2: they never block earlier or later siblings. This supports parallel route groups (sibling passthroughs each resolving their own competition) and structural-element preservation (a passthrough's children render verbatim, including non-Route JSX).

Cleanup is via `child.set(null, () => ...)` - the WeakMap entry is removed on unmount, keeping the registry tight.

This is also the 404 strategy: a `<Route as={NotFound} />` at the end of a parent's children matches everything else and renders only when no earlier sibling claimed the slot.

Specificity scoring (literal=100, `:param`=10, `*`=-1) ships in the matcher but is **not** consulted for arbitration yet - declaration order wins. Specificity-based arbitration is a pending iteration; until then, declare more-specific routes before less-specific ones.

## Package layout

```
packages/router/
  src/
    index.ts          # public exports
    url.ts            # matchPattern + fullPattern + patternSegment, pure
    router.ts         # Router Component
    route.ts          # Route Component + bottom-up sibling resolver
    link.ts           # Link Component
    redirect.ts       # Redirect Component
    url.test.ts
    router.test.tsx
    route.test.tsx
    link.test.tsx
    redirect.test.tsx
    acceptance.test.tsx
```

Match mvc's existing conventions (pnpm workspace entry, root tsconfig extension, `tsc --noEmit && vitest run --coverage`, 100% coverage target). Tests use the shared `vitest` re-export.

## Out of scope (explicit)

- SSR / streaming / `renderToPipeableStream` integration.
- Router-owned loader / action API.
- File-based routing codegen (lives in `expressive-dev`).
- Server-side route definitions.
- View transitions API.
- Route-level metadata / `<head>` management.
- Multi-match across sibling Routes with `as` at the same level. Single-winner-per-level stands; passthrough Routes (no `as`) may coexist freely.
- Distribution from this repo.

## Future shape: Route subclassing for typed identity

`<Route to="" as={X} />` covers the common case but loses typing leverage a subclass would provide:

```ts
class PostRoute extends Route {
  to = '/posts/:id';
  as = Post;
  declare params: { id: string };
}

<PostRoute />
<Link to={PostRoute} params={{ id: '1' }} />
```

Defer until (a) the type story actively pays off in real apps built on the declarative form, or (b) a meaningful behavior difference between leaf and layout Routes emerges that needs a class to express.

## Nice-to-haves

### `Route` per-URL remount opt-in

Default is update-in-place. For pages that need "fresh instance per URL" semantics (one-shot `set(async)` for URL-scoped data, or side-effects in `new()` re-running per URL):

```tsx
<Route to="/posts/:id" as={Post} fresh />
```

Implementation: key the mounted `as` on `this.router.path` when `fresh` is set. Only affects same-pattern, different-params transitions.

### `Link.onClick` (async pre-navigation hook)

User-supplied click handler that runs before navigation. Can be async; resolving to `false` or calling `e.preventDefault()` cancels. Link exposes `pending: boolean` (mirrored as `aria-busy`) during the in-flight window.

```tsx
<Link
  to="/checkout"
  onClick={async (e) => {
    if (cart.isEmpty) { e.preventDefault(); return; }
    await analytics.track('begin-checkout');
  }}
>
  Checkout
</Link>
```

Sketch:

```ts
private go = async (e: MouseEvent<HTMLAnchorElement>) => {
  if (this.pending) return;
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (this.onClick) {
    this.pending = true;
    try {
      const result = await this.onClick(e);
      if (result === false || e.defaultPrevented) return;
    } catch {
      return;
    } finally {
      this.pending = false;
    }
  }
  this.route.goto(this.to, this.replace);
};
```

Subclass-friendly. Pairs with a future Router-level navigation blocker.

## Decisions worth recording

- **URL-spec relative-path anchor.** `./x` from `/blog/post-1` resolving to `/blog/x` (browser/HTML semantics) was rejected. The most common routing pattern - "edit/comments/settings of the current resource" - has no clean expression. Directory anchor wins.
- **Multi-match resolution.** Allowing multiple sibling Routes to match the same URL simultaneously was rejected: same outputs are reachable via a layout's `as`, multi-match complicates resolution, and the orthogonal patterns (modals, palettes, drawers) are state-not-routing concerns. Single-winner-per-level.
- **`exact` prop on `Route`.** Redundant with index-route syntax (no `to` / `to=''`) under single-winner resolution. Skipped.
- **Link/Redirect Route ancestor.** Required, but satisfied automatically: Router renders a wrapping default Route, so top-level `<Link>`/`<Redirect>` work without manual wrapping. (Will need revisiting alongside the Router-as-State conversion.)

## Direction: lexical injection + anonymous Routes (converging, not yet built)

Reconsidering the "independent rendering, no `cloneElement`, no lexical inspection" principle. `render()` already iterates children for `allRoutes()`, so a top-down clone/inject pass is marginal cost and unlocks two things the current bottom-up (context-registration) model can't:

- **Eager, complete NavLinks.** Today a child only registers once it renders, so routes inside an out-of-scope layout never register and nav can't list them until you're already there. A parent enumerating its lexical children injects/registers them all eagerly.
- **Real outlets.** A parent placing a matched child in a chosen slot requires it to hold that child lexically. Non-lexical-into-outlet is a non-starter (a parent can't pull in a Route it doesn't hold), so the injected prop is required for outlets (and is the "you aren't your own outlet -> render false in your lexical spot" signal).

Under injection, **layout-vs-leaf becomes inferable**, so an explicit `layout` marker can likely be avoided. Discriminator is "has Route children," and an index/leaf only makes sense for a *bound* Route (the default page of a parent's base):

| bound? | has Route children? | -> |
|---|---|---|
| bound | no (content/empty) | leaf (index, exact) |
| bound | yes | layout (prefix) |
| unbound (root) | either | layout (can't be an index) |

The one case lexical inspection can't see: routes rendered through an intermediate component (`<Route><Pages/></Route>`). That's the same case injection/outlets rule out by construction, so it's excluded cleanly - supported only as a limited convenience (see anon Routes).

> Context: an earlier spike added an explicit `index` prop (exact leaf) then an explicit `layout` prop (flip the default to exact), with a full test migration. Scrapped as DOA in favor of this inference model - the prop churn isn't worth it if injection makes leaf/layout derivable. The `fallback` role and exact-default thinking carry forward.

### Roadmap (phasing - clear wins first)

Ordered so early work survives regardless of how the injection/anon questions resolve:

1. **Presentation data (non-breaking, independent of the architecture).** `meta` (landed) + `label: string`; default `Item` renders `label ?? path`; retire `ExampleRoute.title` in favor of base `label`.
2. **Anonymous Route (keystone, mildly breaking).** No-prop Route transparent to matching but present in the nav tree. Narrow behavioral delta: filter no-`as` routes out of `active`/`matches`, keep them in `inner`. Land behind the existing tests.
3. **NavLinks grouping.** Needs anon Routes to exist first. Default-flatten so it's safe.
4. **Top-down injection (architectural, breaking - spike behind green tests).** Clone/inject pass -> eager + complete nav registration (fixes out-of-scope routes never registering) + real outlets.
5. **Default flip + leaf/layout inference (mechanical, only after 4).** Infer leaf/layout, make default exact, retire explicit markers. Cheap once injection is in; the expensive-churn version is the scrapped spike.

### Anonymous Routes

A **no-prop `<Route>`** (no `as`, no `to`) is anonymous: **transparent to matching** (contributes no segment, not a match candidate in `active`/`matches`) but **present in the registration tree (`inner`)**. Two jobs:

- **Bifurcate the nav tree without an explicit navigation layer** - since automatic NavLinks is a top-line feature, groups must come for free from structure. Anon Routes are how you create nav groups.
- **Re-anchor intermediate-component routes** - wrap the routes a `Pages` component renders in an anon Route; it injects into them lexically (one level down) while binding them to the nearest real ancestor scope. This is the "convenience with obvious limitation" path for the intermediate case (must wrap explicitly; unwrapped routes stay unbound - considered author error).

Open: how aggressively to hide anon from the tree. Settled so far: hide from *matching*, keep in *nav tree*. Likely just the existing passthrough Route with transparency tightened (no new API) - verify nothing relies on a passthrough's current `inner`/`matches` presence.

### NavLinks grouping

Groups are **structural** - they come from anon Routes in the tree, not a per-route prop. NavLinks' walk renders a wrapper for a group node and recurses; a path-less node flows through (default `Item` returns `children` when there's no path). Whether this is an explicit `Group` slot (override `return props.children` to flatten) or implicit walk behavior is a Phase-3 detail. (An earlier idea folded grouping into a per-route `nav` component that rendered its own children; dropped along with `nav` - see below.)

### Route presentation: `label` + `meta`

Route carries display **data**; consumers (NavLinks, a future Breadcrumbs, a title effect) own **presentation**. Two fields, and deliberately no per-presentation props (`icon`/`shortLabel`/`tabLabel` sprawl into one-off variants):

- **`label?: string`** - the route's universal, consumer-agnostic textual identity. Usable by *any* consumer including text-only ones (`document.title`, `aria-label`, breadcrumbs). Generalizes the `ExampleRoute.title` subclass field - retire that for base `label`.
- **`meta?: Record<string, any>`** - catch-all data a *subclass-free* Route can attach (icon refs, order hints, badges) for consumers wanting more than text. Surfaced **directly** to NavLink entry components alongside `active` (not reached through `route`, mirroring how `active` is flattened). *Landed (Phase 1).*

Presentation differences (sidebar shows an icon, breadcrumb shows only text) live in the **consumer component**, not the Route - the consumer *is* the "type". So no role/`context` param threaded into a route-level renderer; distinct consumers (NavLinks vs Breadcrumbs) are the differentiation. A role-param'd `label={(ctx) => ...}` was considered and parked - it leaks immediately (text-only consumers still need a plain string back). YAGNI.

**Rejected: a `nav` prop** (element|component entry for NavLinks). It only held up while nav-*specific*; the moment the field must also serve breadcrumbs/title it demotes to agnostic data, and the only universal datum is text -> `label`. Per-route *visual* override, if ever truly needed, stays the consumer's `Item` subclass.

**Breadcrumbs** then falls out as a sibling consumer: walk the matched-route chain, render each `label`. Same tree, same field - the payoff that validates `label` at the agnostic-string altitude.

### Adjacent / later

- **Breadcrumbs component (TODO).** Sibling to NavLinks: walks the active-route chain and renders each `label`. First consumer to prove the agnostic-`label` thesis beyond NavLinks. On the plan.
- **Expand example dogfooding.** The examples app is the working proof of the router; several features (nesting, groups, breadcrumbs, redirects) aren't exercised yet. Once nesting reaches a stable stopping point, add router-specific examples and surface a **router group** in the examples UI. That requires tweaking example test/discovery (current discovery is flat - one example per dir; nesting/grouping needs the discovery + nav to represent a tree). Gated on the nesting work landing.

## Open questions

1. **Relative paths at the Router level.** `Router.get().goto('./x')` currently throws. Could resolve against `router.path` as a directory if a real use case shows up.
2. **`goto` second-arg expansion.** Currently `goto(to, replace?: boolean)`. Deferred opts (query sugar, `history.state`, scroll control, view transitions) may eventually justify migrating to `goto(to, opts)`. Migration is mechanical when needed.
3. **`Link` style API.** Just `className`, or also `activeClassName` via `NavLink`? Defer to v1.1.
4. **Programmatic navigation outside Components.** Module-level `goto()` that finds the active Router? Probably no - keep instance-scoped.
5. **Remount keying granularity (if `fresh` lands).** Key on full pathname vs only the Route's own captures? Pathname is simpler; revisit if needed.
6. **Typed `to` strings.** Template-literal type extracting required params. Nice-to-have.
7. **Structural remount-boundaries.** Once leaf `fresh` lands, a layout-level "this subtree is a remount unit" form may follow.

## Home

Router stays in this repo permanently (see header). Post-#100 the dependency is public-API only; post-#106 it drops host imports entirely and depends solely on `@expressive/mvc`'s agnostic pragma, with whatever adapter the app installs (react/preact/solid/web) completing it at the edge. That leaves no host-specific or standalone repo it could move to - this is the home, not a waypoint.
