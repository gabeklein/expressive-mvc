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

The MVP and PLAN iteration steps 2-4 are implemented, Router runs on `Component`, and the headless-core / `BrowserRouter` split has landed. The remaining work is the documented iteration steps 1 + 5-9 and a handful of nits.

### Landed

- **Matcher** (`url.ts`): literal segments, `:param`, trailing `*` catch-all, trailing-slash normalization, case-insensitive literals. Returns `{ params, score }` for specificity ordering.
- **Specificity scoring** lives in `url.ts` (literal=100, `:param`=10, catch-all=-1, pure-literal bonus +1) but the resolver currently arbitrates by **declaration order only** - the first matching sibling with `as` wins. Specificity-based arbitration is a pending iteration; users must declare more-specific routes before less-specific ones.
- **Router** (`router.ts`, `extends Component`): split into a **headless core** and a **`BrowserRouter`** binding.
  - **`Router` (headless core)**: host-agnostic. In-memory `path` (defaults to `'/'`) plus an in-memory history stack (`entries`/`index`, seeded from the initial `path`) with `back()`/`forward()` and `replace` semantics. `goto` validates absolute + normalizes + pushes/replaces the stack + mutates `path` state, **no `window`/`history` access**. Owns the URL primitives: `match(base, to)` (reactive on `path`), `anchor(route)`, `resolve(route, url)`, `segment(to)`, `goto(to, replace?)` (absolute-only, throws on relative). Runs and tests under any host; *is* the memory router (no separate class).
  - **`BrowserRouter extends Router`**: binds the core to the DOM. `path` initializes from `window.location.pathname`; its own `goto` drives `history.pushState`/`replaceState`; `back`/`forward` delegate to `window.history` (the browser owns the stack, so the inherited in-memory `entries`/`index` go unused here); a `popstate` listener plus monkey-patched `history` methods make `sync()` the single writer of `path` so programmatic navigation outside `goto` still syncs. Shared absolute-path guard and DOM-free `normalize` are hoisted helpers.
  - Auto-spawned as a `Context.root` singleton on first Route mount (Route's fallback spawns the headless `Router`; apps provide a `BrowserRouter` explicitly via `<Provider for={Router}>` or by rendering one).
- **Route** (`route.tsx`, `extends Component`): `to`, `as`, `parent = get(Route, false)`, derived `base`, `match`, `matched`, `active`, `matches`, `anchor`, `resolve`, `goto`. (The see-through predicate "has lexical child Routes" is an internal helper, not public state.) **Default `to=''`** (exact scope index). Matching is the strict-see-through model below: a Route with lexical child Routes is a see-through scope (matches iff a descendant matches, via the synchronous `matchesAnywhere` gate); a childless Route is exact; `*` marks opaque delegation; a parent-less no-`to`-prop Route is an always-on root. See-through scopes render their children **unconditionally** (mount-everything → complete registration), wrapping in `as` only when matched; content renders at the matched leaf (self-read). Sibling arbitration is bottom-up via registration order. Render and the sibling walk read `matched` (boolean) instead of `match` so same-pattern navigations don't re-render the Route - `matched` stays `true` across `/posts/foo` -> `/posts/bar` (Consumers inside pick up new params reactively). See [§ Matching model](#matching-model-strict-see-through--always-on-roots-implemented).
- **Router auto-spawn**: `router: Router = set(() => this.get(Router, false) || Router.new())` on Route. The `set()` factory runs lazily on first access (during Route's render), well after context wiring. Context lookup finds any explicitly-provided Router; otherwise `Router.new()` activates a fresh instance that lands in `Context.root` via the `register` fallback so subsequent Routes find it. `set()` is also load-bearing for reactivity - it makes `router` a managed Route property so cross-state reads (`router.path` from Route's render) wire subscriptions via the proxy machinery in [observable.ts:119-120](../mvc/src/observable.ts#L119-L120).
- **Link** (`link.tsx`): `to`, `replace`, `href` getter (resolved absolute path), modifier/middle-click bailout. Requires Route in context (always available because Router provides one).
- **Redirect** (`redirect.ts`): fires `goto` in `new()` (StrictMode-safe). `when` prop gates whether navigation fires on mount.
- **Update-in-place**: Route renders `<Page>{children}</Page>` with no `key`, so same-pattern navigation reconciles in place; `params` updates reactively.
- **Acceptance tests** (`acceptance.test.tsx`) cover the nested file-routing tree: nested layouts (index + dynamic + catch-all sibling), `params` capture, instance preservation across same-pattern navigation.

### Pending - iteration

In rough order of priority:

1. **Search params**: `search` field on Router (raw string), `query` getter returns `URLSearchParams`. Sync in the same listener that syncs `path`.
2. **`redirect()` / `notFound()` sentinels**: throw, caught by nearest `Route.catch`. Sets fallback or calls `goto`.
3. **`NavLink`**: subclass of `Link` with active-class support.
4. **Scroll restoration**: one Component subclass listening for navigation events.
5. **`HashRouter`**: a `BrowserRouter`-shaped sibling reading/writing `location.hash`. (Memory routing needs no separate class - see below: the headless `Router` *is* the memory router, with an in-memory history stack + `back`/`forward` built in. `BrowserRouter` delegates `back`/`forward` to `window.history`.)
6. **`Link.onClick`** (async pre-navigation hook): user-supplied handler that can cancel; exposes `pending: boolean` for in-flight state. Detailed sketch under "Nice-to-haves".
7. **Specificity-based arbitration**: feed `match.score` into the sibling walk so literal beats `:param` beats `*` regardless of declaration order. Currently first-match-wins.

### Ship roadmap (PR plan to main)

Strategy: merge `feature/router` to main first (foundation lands as-is), then MVP features
arrive as small, individually-reviewable PRs against main. `feature/router-transition`
(deferred presentation) rebases onto the shrinking delta and ships later - exotic next to
the items below.

**Gate 0 - host-agnostic router (prerequisite to the main merge):**

- `feat(mvc)`: agnostic JSX runtime (#106) - `@expressive/mvc/jsx-runtime` delegating to an
  adapter-registered host, plus element-introspection seam (`childrenOf`, `isElement`,
  `typeOf`, `propsOf`) and `Fragment`. Today mvc exports the `Node` *type* seam but no
  *value* seam.
- `feat(react)`: adapter registers its runtime + introspection.
- `refactor(router)`: imports swap to `@expressive/mvc`, `jsxImportSource` flips, React
  type/introspection usages replaced. After this, router's sole dependency is mvc; react
  remains test-host only.
- Before merging: confirm release tooling (release-please) won't publish
  `@expressive/router` prematurely - mark private/excluded until the MVP cut is in.

**MVP feature PRs (post-merge, in order):**

1. `fix(router)`: specificity-based arbitration (iteration #7) - correctness footgun,
   purely internal, score already computed in `url.ts`.
2. `feat(router)`: search params (iteration #1).
3. `feat(router)`: `redirect()` / `notFound()` sentinels (iteration #2) - likely surfaces
   design questions (interaction with `Route.catch`, destroyed-state semantics mid-redirect).
4. `feat(router)`: navigation UX - `NavLink` + scroll restoration (iterations #3 + #4
   grouped; both are small leaf components with no core interaction).

Deferred with transitions: `HashRouter` (iteration #5), `Link.onClick` (#6), top-down
injection (architecture roadmap #5).

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

`extends Component`. The headless **`Router`** owns `path` reactively in memory (no DOM); **`BrowserRouter`** binds it to the browser - listens to `popstate` and monkey-patches `history.pushState`/`replaceState` so programmatic navigation outside of `goto` (e.g. third-party libs) still syncs `path`. Renders a default catch-all `<Route>` so descendants always have a Route in context.

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
- `''` - matches parent base exactly (index); the **default** `to`
- `'*'` - catch-all; explicit marker for opaque delegation (a component that routes internally). No longer a default.
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
    router.ts         # Router (headless core) + BrowserRouter binding
    route.tsx         # Route Component + bottom-up sibling resolver
    link.tsx          # Link Component
    redirect.ts       # Redirect Component
    nav.tsx           # NavLinks Component
    url.test.ts
    router.test.tsx   # headless Router suite + BrowserRouter suite
    route.test.tsx
    link.test.tsx
    redirect.test.tsx
    acceptance.test.tsx
```

Match mvc's existing conventions (pnpm workspace entry, root tsconfig extension, `tsc --noEmit && bun test --coverage`, 100% coverage target). Tests run under `bun test` (happy-dom + setup preloaded via `bunfig.toml`).

## Suspense & transitions (planned)

Two capabilities about *when* and *how* a navigation presents, both riding **one overridable `transition(commit)` seam on the Router** (consistent with `NavLinks`/Route member overrides): base = **deferred presentation** (no-flash; default `startTransition` + a `pending` flag), subclass = deferral + **animation** (override `transition` to bracket the swap in the View Transitions API; consumer owns the CSS). Page-level loading already works - every `@expressive/react` Component auto-Suspends with its own `fallback`. The key enabler is Expressive's `set` (silent update + synchronous emit), used to make the `path` change notify *inside* `startTransition` so the old screen holds.

Full design, requirements, and the implementation plan live in the working doc **`FEATURE.md`** (fold into here + delete on ship). The former `Route.fallback`-vs-loading conflict is resolved: Route's no-match branch is now the `default` prop, freeing `fallback` for Component's Suspense/error meaning.

## Out of scope (explicit)

- SSR / streaming / `renderToPipeableStream` integration.
- Router-owned loader / action API.
- File-based routing codegen (lives in `expressive-dev`).
- Server-side route definitions.
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

#### Possible direction: `Layout` / `Label` as consumed subclass methods

For the subclass path (not the prop path), chrome has no home. When a Route subclass overrides `render()`, composition makes the subclass render the inner layer and `Route.render` the outer; `compose()` installs `children` as a *getter*, so base render takes the children-getter branch ([route.ts:198-199](src/route.ts#L198-L199)) and returns `matched ? props.children : null` - it **never reaches the `as` branches**. So a subclass whose `render()` returns its child-route structure cannot attach chrome via `as`, and can't wrap its matched descendants by return-value composition either (they render independently, bottom-up). A dedicated slot consumed by base render is the only clean option.

Shape: `Layout(props)` (and maybe `Label(props)`) as **overridable members** the base consumes unconditionally - the same pattern `NavLinks` already ships (`List`/`Group`/`Item` overridden by a subclass, base orchestrates). `Route.render` would wrap the children-getter result: `matched ? (this.Layout ? Layout({children}) : props.children) : null`.

- This is the *method* form, distinct from a `<Layout>` child element (that one needs the positioned-outlet justification - see P5 outlets - to earn its keep).
- Orthogonal to `as`-the-prop, which stays the declarative-path surface for *target content*. `Layout` is the subclass-path surface for *chrome*. Two authoring styles, two surfaces; no competition.
- `Layout` advances on filling a real gap (subclass chrome, no other home). `Label` is the riskier twin: a rendering `Label()` relocates per-route label *presentation* onto the Route, overlapping `NavLinks.Item` and reopening the settled "presentation lives in the consumer" call ([§ Route presentation](#route-presentation-label--meta)). Hold it until it can name what the `label` string + a consumer `Item` can't already do.

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

> Context: an earlier spike added an explicit `index` prop (exact leaf) then an explicit `layout` prop (flip the default to exact), with a full test migration. Scrapped as DOA in favor of this inference model - the prop churn isn't worth it if injection makes leaf/layout derivable. The `default` (no-match) role and exact-default thinking carry forward.

### Roadmap (phasing - clear wins first)

Ordered so early work survives regardless of how the injection/anon questions resolve:

1. **Presentation data (non-breaking, independent of the architecture).** `meta` (landed) + `label: string`; default `Item` renders `label ?? path`; retire `ExampleRoute.title` in favor of base `label`.
2. **Anonymous Route (keystone, mildly breaking).** No-prop Route transparent to matching but present in the nav tree. Narrow behavioral delta: filter no-`as` routes out of `active`/`matches`, keep them in `inner`. Land behind the existing tests.
3. **NavLinks grouping.** Needs anon Routes to exist first. Default-flatten so it's safe.
4. **Matching model (DONE).** Landed as *strict see-through + always-on roots* - see [§ Matching model](#matching-model-strict-see-through--always-on-roots-implemented). (Built on A1's exact-default + `*`; adds strict see-through, always-on roots, mount-everything, leaf-owned content.) Pure-data, synchronous, no new runtime construct; does not depend on injection.
5. **Top-down injection (architectural, breaking - spike behind green tests).** Clone/inject pass -> eager + complete nav registration (fixes out-of-scope routes never registering) + real outlets. Decoupled from matching now; wanted for outlets and complete nav, not for the default.

### Matching model: A1 - exact-default + `*`-delegation (superseded - kept for rationale)

> **Superseded by [§ Matching model: strict see-through + always-on roots](#matching-model-strict-see-through--always-on-roots-implemented).** A1's exact-default + `*` survives; what changed: "lexical child Routes → prefix" is implemented as *strict see-through* (matches iff a descendant matches, not greedy), plus always-on roots, mount-everything, and leaf-owned content. Kept below for the reasoning that still holds.

Replaces the whole `exact`/`index`/`catchAll`-attribute thread *and* the prefix-default + remainder-poison spike. The chain of reasoning:

1. **Lexical-children inference is unsound.** `<Route to="posts/:id" as={Post}/>` looks like a leaf, but `Post` can render `<Route>`s internally - so "no lexical child Routes" does not mean "no children." You cannot infer leaf from the absence of lexical children.
2. **But the *inverse* inference is sound.** Lexical child Routes *present* unambiguously means prefix. A1 uses only the sound direction and makes the unknowable case (`as` routes internally, no lexical children) explicit via `*`.
3. **Prefix-default was a wrong turn.** It made every route swallow trailing garbage, which then needed remainder-poison (a render-phase reject + cascade) to recover exactness - a new runtime construct, render-phase registration rework, and a backtrack double-render. Exact-default makes the leak *structurally impossible* instead of recovering from it.

**Definition.** A Route matches in one of two modes:

- **exact** - path equals the full pattern (`base` + own segments), no remainder.
- **prefix** - path *begins with* the pattern; remainder delegated downward (to lexical child Routes, or to the `as` component which routes internally).

Mode is determined structurally, no flag in the common case:

1. trailing `*` → **prefix**, route *owns the remainder* (delegates to `as`), captures it into `params['*']`;
2. else lexical child `Route`s present → **prefix**;
3. else → **exact**.

Default `to` is exact of `base`; bare `<Route as={Home}/>` is the scope index (matches only `/`). The no-match branch is unchanged: a lexical `default` Route is the "nothing in this scope matched" branch; a 404 is just "no sibling matched, scope/root `default` renders."

What falls out:

- `<Route to="posts/:id/*" as={Post}/>` routes internally → `*` transfers remainder ownership; below it routing is lexical again, `Post` owns its own `default`. (The case that killed lexical inference - handled by one explicit token.)
- `<Route to="about" as={About}/>`, `/about/garbage` → exact, no match → falls to `default` → clean 404. **No leak, no sentinel.**
- `<Route as={Home}/>`, `/about` → exact `/` only. No index footgun, no `index` keyword.
- The single explicit marker is **`*`** = "my `as` component owns everything below" - the one boundary structure can't see into. Matches React Router's `path="x/*"` intuition. `exact`/`index`/`catchAll`-attribute all retired.

**Why this over prefix-default + poison** (the ledger): equal ergonomics in the common case (exact leaves, lexical layouts, index, 404 all need zero annotation), but A1 has **no new runtime construct, no registration rework, no double-render, and a safer failure mode** - forgetting `*` is a loud dev-time 404, not a silent leak. Matching stays **pure data** (`(pattern, path)`), fully synchronous, no lean on Expressive's effect/async machinery. The poison model bought only "no `*` token in the delegation case" at the price of a control-flow mechanism - a bad trade.

Concrete change: flip `to` default from `'*'` to exact (`''`/index), add "lexical child Routes → prefix," keep `*` meaning "own everything below." `url.ts` change is small and pure-data; no registration rework.

#### Parked: remainder poison / sentinel bailout (not rejected)

Still interesting - it's the path to *marker-free* prefix-default (exactness emergent, even `*` unnecessary), via a synchronous render-phase **sentinel throw** (not Suspense - a 404 is synchronously known, nothing to await) caught by a dedicated per-scope error boundary, so the dead-end subtree never commits (no effect/microtask, no committed double render; only sibling-backtrack forces a real re-render). Deferred, not killed: it needs more understanding of scope (render-phase registration would leak on unwound subtrees - must move to commit phase or be reconcilable) and of how other features shake out (outlets, P4 injection, nav registration) before its cost is worth paying. Revisit if marker-free prefix becomes a goal; until then A1's one token is cheaper than the mechanism.

### Matching model: strict see-through + always-on roots (implemented)

Refines and supersedes A1. The shipped A1 commit (1c7a6b0e) landed `*`-delegation + exact-default but dropped "lexical child Routes → prefix"; the live Examples bug (a group with children silently failed to suppress the sibling default) was exactly that hole. This is the model as built (suite green).

**Supersedes:** the NavLinks claim that "a headless scope (no `as`) is *not* see-through." Any Route with lexical child Routes is see-through, regardless of `as`/`to`.

#### Match modes

Keyed on the Route's **own lexical children** (synchronous via `props.children`), never on `as`:

1. **Has lexical child `Route`s → strict see-through.** Matches **iff a descendant matches** (children composed against the Route's base), decided by the synchronous lexical opt-out gate `matchesAnywhere`. *Strict*: a prefix with no matching descendant does **not** match - it bubbles to the nearest `default`. No `*` needed; `*` would be wrong here (catch-all swallows the mismatch and kills the bubble).
2. **No lexical children, `as` routes internally → `*` (opaque delegation).** The one case structure can't see into; `*` opens the prefix gate so the component mounts at deep paths (e.g. `<Route to="*"><Pages/></Route>`). **Irreducible** - no scheme (lexical or bottom-up) can infer it (bootstrap deadlock: the Route must already be a prefix to mount the component that would reveal it routes internally).
3. **Childless, no `*` → exact.** With `to=''` this is the **scope index** (`<Route as={IntroIndex}/>` lands `/intro`).

#### Always-on roots

A **parent-less Route with no `to` *prop*** (`!parent && !('to' in props)`, guarded for prop-less stubs) is **its own root**: always matched, capturing everything below. This is what makes a root layout always render, and lets a Route tree be dropped in anywhere as a self-contained, always-on scope (composition; see the nested/sub-router feasibility study). An explicit `to=""` at the root stays an index. (This is the one intentional use of `'to' in props` - distinguishing a bare root from an explicit root index; it does not key the see-through predicate.)

#### Rendering: mount-everything + leaf-owned content

- A see-through scope renders `{children}` **unconditionally** (every Route registers → complete sidebar/nav from registration), wrapping in `as` chrome **only when matched**. Unmatched leaves render `null` but still register (their `as` does not run - no side effects).
- **Content renders at the matched leaf** via a **self-read** (`Route.get()` = itself). Ancestors supply chrome *around* content; they never reach *down* for a descendant's data. The earlier `IFrame`-reads-`branch` shape (ancestor synthesizing content from a descendant) was rejected - it caused a render-order race, the discards-children problem, and forced a lexical `branch`. Methodology tell: **if a layout needs a descendant's data to render *content*, push the content to the leaf.**
- `as` is **orthogonal chrome**: present iff the Route matches.

#### Default (no-match branch)

`default.matched = parent.matched && !parent.matches.length`, plus two scoping rules:
- **`within`-scoped:** a `default` keeps its scope matched only when the path is inside the scope's base (root base `''` contains everything → app-404 everywhere; `/posts` only within `/posts`), so a section 404 does not leak to sibling scopes.
- **`matches` counts section-default resolution:** a see-through scope that resolves to its *own* section default is counted by its parent, so an ancestor 404 does not *also* fire. (Intuition: a `default` is a scoped last-resort match; a scope that owns its 404 has resolved, so its parent sees it as matched.)

#### Engine: `matchesAnywhere(children, base, path)`

Lexical, top-down, **synchronous, pure-data**: walks `props.children`, composes each nested `<Route>`'s base, returns whether any descendant matches. Used **only** as the see-through opt-out gate. Blind to class-field `to` (subclasses) and component-internal routes (the `*` case) - both the documented limits of the lexical model.

#### Default `to`: `'*'` → `''`

A childless no-`to` Route is the exact scope index. The see-through predicate is structural (`allRoutes(props.children)`); the only `'to' in props` use is the always-on-root distinction above.

#### Acceptance fixture (`examples/_base/Examples.tsx`)

```tsx
<Route as={Shell}>                                  {/* always-on root: nav always renders */}
  <Route to="" redirect={first.path} />             {/* '/' → first example (index redirect) */}
  <Route to="intro" label="Intro">                  {/* see-through section, NO * */}
    <Route as={IntroIndex} />                        {/* '/intro' index */}
    <Route to="basics" as={ExampleFrame} meta={{ file }} />  {/* leaf renders its own content */}
  </Route>
  <Route default as={NotFound} />
</Route>
```

`ExampleFrame` reads its **own** route (`const { meta } = Route.get()`) to render `<iframe src={meta.file}>`. Paths: `/` → redirect; `/intro` → index; `/intro/basics` → leaf; `/intro/bogus` → bubbles to `NotFound`; `/totally/bogus` → `NotFound`. NavLinks lists all sections/examples (mount-everything), independent of path.

#### Deferred

- **`branch` (ancestry accessor)** - a deepest-first chain of matched Route *instances*, for breadcrumbs / ancestor reads. Not built; the leaf self-read covers the common case. When added it is *display-only* (chrome/structure), never a content source. Eventually should take the name `match` once that getter's params role moves to `params`.
- **Bottom-up unwinding / injection (P5)** - would let opaque-component routes (mode 2) be discovered without `*`, and complete the sidebar for not-yet-mounted opaque subtrees.

### Anonymous Routes

A **no-prop `<Route>`** (no `as`, no `to`) is anonymous: **transparent to matching** (contributes no segment, not a match candidate in `active`/`matches`) but **present in the registration tree (`inner`)**. Two jobs:

- **Bifurcate the nav tree without an explicit navigation layer** - since automatic NavLinks is a top-line feature, groups must come for free from structure. Anon Routes are how you create nav groups.
- **Re-anchor intermediate-component routes** - wrap the routes a `Pages` component renders in an anon Route; it injects into them lexically (one level down) while binding them to the nearest real ancestor scope. This is the "convenience with obvious limitation" path for the intermediate case (must wrap explicitly; unwrapped routes stay unbound - considered author error).

Open: how aggressively to hide anon from the tree. Settled so far: hide from *matching*, keep in *nav tree*. Likely just the existing passthrough Route with transparency tightened (no new API) - verify nothing relies on a passthrough's current `inner`/`matches` presence.

### NavLinks grouping

Groups are **structural** and come from the tree, not a per-route prop. Implemented (Phase 3): `branch()` routes a node through the `Group` slot when it has **no `as` and has children** - i.e. a route with no page of its own is a *section*, not a destination. Default `Group` flattens (`return children`); override it to render a heading/section. A route *with* `as` (or a childless leaf) renders as an `Item` link.

Note the predicate split:
- **nav role** keys on **`!as`** (page vs. structure) - used by `branch`. Covers *both* anonymous Routes (`no as` + `no to`) and headless scopes (`<Route to="x/*">`, no `as`). A headless scope is a section that *owns* a URL segment; its relative children compose under it.
- **matching transparency**: ~~keys on `route.group` (`no as` + `no to`)~~ **Superseded** by [§ Matching model](#matching-model-strict-see-through--always-on-roots-implemented): transparency now keys on "has lexical child Routes" (internal `hasRoutes` helper), so `active`/`matches` see through *any* Route with child Routes regardless of `as`/`to`. The old `group` getter is gone.

(An earlier idea folded grouping into a per-route `nav` component; dropped along with `nav` - see below. An even earlier cut keyed `branch` on `route.group`, which broke headless scopes - they rendered as always-active links since `to="x/*"` matches the whole section.)

### Route presentation: `label` + `meta`

Route carries display **data**; consumers (NavLinks, a future Breadcrumbs, a title effect) own **presentation**. Two fields, and deliberately no per-presentation props (`icon`/`shortLabel`/`tabLabel` sprawl into one-off variants):

- **`label?: string`** - the route's universal, consumer-agnostic textual identity. Usable by *any* consumer including text-only ones (`document.title`, `aria-label`, breadcrumbs). Generalizes the `ExampleRoute.title` subclass field - retire that for base `label`.
- **`meta?: Record<string, any>`** - catch-all data a *subclass-free* Route can attach (icon refs, order hints, badges) for consumers wanting more than text. Surfaced **directly** to NavLink entry components alongside `active` (not reached through `route`, mirroring how `active` is flattened). *Landed (Phase 1).*

Presentation differences (sidebar shows an icon, breadcrumb shows only text) live in the **consumer component**, not the Route - the consumer *is* the "type". So no role/`context` param threaded into a route-level renderer; distinct consumers (NavLinks vs Breadcrumbs) are the differentiation. A role-param'd `label={(ctx) => ...}` was considered and parked - it leaks immediately (text-only consumers still need a plain string back). YAGNI.

**Rejected: a `nav` prop** (element|component entry for NavLinks). It only held up while nav-*specific*; the moment the field must also serve breadcrumbs/title it demotes to agnostic data, and the only universal datum is text -> `label`. Per-route *visual* override, if ever truly needed, stays the consumer's `Item` subclass.

**Breadcrumbs** then falls out as a sibling consumer: walk the matched-route chain, render each `label`. Same tree, same field - the payoff that validates `label` at the agnostic-string altitude.

### Adjacent / later

- **Breadcrumbs component (TODO).** Sibling to NavLinks: walks the active-route chain and renders each `label`. First consumer to prove the agnostic-`label` thesis beyond NavLinks. On the plan.
- **Expand example dogfooding.** The examples app is the working proof of the router; several features (nesting, groups, breadcrumbs, redirects) aren't exercised yet. Once nesting reaches a stable stopping point, add router-specific examples and surface a **router group** in the examples UI. That requires tweaking example test/discovery (current discovery is flat - one example per dir; nesting/grouping needs the discovery + nav to represent a tree). Gated on the nesting work landing. (Partly landed: Simple/Advanced grouping via scoped nested Routes.)

### URL-agnostic core: structured segments (2.0 direction)

Routing is URL-string-coupled end to end today: patterns are slash-strings (`"blog/:id/*"`), `BrowserRouter.path` *is* `window.location.pathname`, and the matcher (`url.ts`) splits/compares strings. That slash-string is the single thing binding the router to the web - awkward for non-URL hosts (native apps navigate a *stack of named screens + params*, not a path), which cuts against the host-agnostic charter.

Direction: make the **canonical route representation structured** - a segment array with match modifiers as data/attributes, not embedded string syntax - and treat the slash-string `to` as a *convenience that desugars* to it. `window.location.pathname` becomes the web adapter's serialization; a native adapter maps its navigation state to the same structure with no string in the middle. The headless-core / `BrowserRouter` split already isolates the string↔location boundary in `BrowserRouter`, so that seam is the conversion point.

- **`*` (catch-all)**: resolved by the matching model, not here. `*` is *not* deprecated to an attribute - it survives as the explicit marker for opaque delegation. Orthogonal to the substrate rewrite: the matching model landed on the string matcher and does not require structuring `url.ts` first.
- **`:param`** → structured segment (`{ param: 'id' }`); string `:id` stays as **web sugar**.
- Keep string `to` + `:param` as ergonomic web sugar (don't drop `/`-routes wholesale); make the *core* structured.

Cost: substrate rewrite - `url.ts` (match a structured location, not a string), `Router` (pluggable structured location source), `Route` (pattern as array). Specificity scoring, relative-path resolution, and anchors are all string-based today and need structured equivalents. 2.0-tier; independent of the matching model (which is settled on the string matcher) but a natural follow-on now that the exact / strict-see-through / `*` modes are settled as data. Gated on the audit (whether a non-web host is actually near-term).

## Feasibility study: nested / sub-routers (TODO)

Big-ticket, not yet scoped - flagged for a dedicated feasibility pass. The idea: let a user spawn a **subrouter inside the overall one**, so a region of the UI runs its own route space. Two modes to evaluate:

- **Air-gapped** - the subrouter owns an independent path that does not touch the URL bar. State-only navigation for self-contained widgets: multi-step **wizards**, **UI panels**, drawers, command palettes - flows that want back/forward and route semantics without polluting the browser URL or history. The headless `Router` (now a standalone in-memory router with its own stack + `back`/`forward`) is most of this already; the question is wiring + context scoping.
- **URL-extending (virtual)** - the subrouter composes *onto* the parent's path, extending it virtually (a nested base) rather than air-gapping. Closer to today's nested `Route` bases but promoted to a first-class nested Router with its own provider/scope.

Things the study must answer: how a subrouter acquires/overrides Router context (a scoped `<Provider for={Router}>` with a fresh `Router` instance is the obvious lever); whether `Route`/`Link`/`goto` resolve against the nearest Router or can target an ancestor explicitly; how air-gapped vs URL-extending is selected (prop vs subclass); and how the headless `Router`'s in-memory stack composes (or doesn't) with the browser stack above it. The headless-core split is the enabling groundwork - an air-gapped subrouter is just a headless `Router` provided in a nested scope. Gated behind a real design pass before any implementation.

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
