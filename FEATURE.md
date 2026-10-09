# @expressive/dev

Next-like host for Expressive: Vite, `@expressive/dom` rendering, file-based routes, a server lane. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/dev-server` is the trunk. Each feature lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Upstream fixes (mvc, dom, router) land on `main` as their own PRs, never only here.
- `backup/dev-server-full` holds the pre-trunk prototype - source for the queued features below. Its POST dispatch and client stubs seed the MVP; its `app/api` lane comes later. Delete once nothing is left to carve.
- Stack PRs: each targets the previous one's branch, the bottom one the trunk; merge a lower branch up into the ones above it as it moves.
- Verify in a browser, not only unit tests: `bun run e2e` in `example/` (set `CHROME`). After rebuilding a package, a dev server can serve a stale `@expressive/*` from `example/node_modules/.vite` - delete it (the E2E dev project always does).
- Specs live in `example/e2e/` for now; colocating them beside routes is allowed later - the dependency scan already skips `*.spec.*`/`*.test.*` under `app/`.
- Trunk commits carry no trailers.

## Agreed shape

- **One surface.** The root export has `browser` and `default` (server) builds with identical names. `serve` is real on the server, throws in the browser.
- **Turnkey.** dom, router, inspect are dependencies; `@expressive/mvc` is the only peer.
- **JSX.** `jsxImportSource: "@expressive/dev"` - dev's runtime re-exports dom's.
- **Router.** dev exports its own `Router` (extends `BrowserRouter`) and `Route`, plus `Link`, `NavLinks`, `Redirect`. No `BrowserRouter` export.
- **Config.** `index.ts` default-exports `config({...})`, read on the server.
- **Server modules, one model.** Sidecars (`app/**/api.ts`) and `app/api/**` share one invocation path from the bundled client and one instance model (below). `app/api` has its own root; a sidecar call never passes through `app/api/index.ts`. Process globals are the only layer both lanes share.
- **Session is the app's concern.** dev does not detect or mint sessions or tabs; an app expresses identity through keys (below). Recipes may come later.
- **dom on the server.** Needed for JSX rendered to HTML (responses, emails), not SSR.
- **Monkey-patch first.** Where mvc or an adapter lacks a seam, dev patches it in one file, replaced when upstream catches up. Stress-tests the concept before committing upstream.
- **Server `get`/`use` are dev's, permanently.** Request-scoped resolution is a host concern - no core or dom change. The server build replaces `State.get`/`State.use` (installed after dom evaluates, asserted at boot) and overrides only the no-argument `Context.get()`; the client keeps dom's behavior.
- **Process globals stay core's.** `static global` with a module-scope `X.new()` registers in the real root, untouched by requests. Opt-in sugar for this (#473) is the maintainer's call and blocks nothing here.

## Landed

- Basics - `app/` route tree (`Page`, `Layout`, `Loading`, `Catch`, `NotFound`), single-file `app.tsx` mode, virtual shell/entry/router module, dev server with inspect, client + node service build, static `serve` with `index.html` fallback, example workspace.
- Route chunks - a route module (not the root) loads on first entry, `default` included - an entry hook loads its module, then runs; a class resolves from it. `Loading` and `Catch` keep a module static: they must be on hand before anything below them waits or fails.
- Route defaults - a page module's `default` function is its entry hook (runs with the Route before it renders, may be async; a returned string redirects, `null` forfeits to the 404). A `default` class - State or Component alike - renders around the route's content (`<X>{children}</X>`, or `<X><Layout /></X>` with a `Layout`) and is provided to everything below it.
- Loading - a module's `Loading` fills its `Layout`'s content slot: every route rendered there gets it as its `fallback`, at any depth until a nested `Layout` starts a fresh slot; a page's own `Loading` covers that page first. It shows when a page cannot show anything yet - chunk, entry hook or data - which in practice means a cold arrival, since in-app navigation holds the current page. dev's `Route` owns no boundary by default (`fallback = false`, `catch` only with a `Catch`), so a page class's waits reach the slot; generated routes always declare theirs, `null` where no `Loading` applies.
- E2E harness - `example/e2e/` Playwright specs run against the dev server and the built service (`bun run e2e` in `example/`). Each feature adds its page and spec. Not in CI yet: trunk PRs run `verify` only.

## MVP

Enough to write E2E tests and examples and feel the ergonomics. One PR each, in order. Everything under Later waits until the MVP has been used.

1. **Sidecar calls.** Each export of `app/**/api.ts` becomes a browser stub; a call is a POST answered with JSON, or `{ error }` with a 4xx/5xx status. Scanner allowlist and build errors, stubs, dispatch, import rule (importable only from the sidecar's folder and below). Wire shape: see Open.
2. **Call context.** The request in `AsyncLocalStorage`; the route walk computing each layer's prefix; static `key`/`use` caching; server `T.get()`/`T.use()` - both throw outside a call.
3. **Twins (pull).** Client `X.use()` of a server class - a route's `default` or any component - attaches a twin for that mount and detaches on unmount. The server resolves the instance through the class's key; the reply carries a snapshot and version, and the twin suspends until then. Methods are calls; a reply carries the call's patch and version, applied before the call resolves - an awaited call never sees a stale twin. Twins are read-only - an invariant, not an MVP shortcut: server values change through methods, and assigning a twin field throws.
4. **Push (SSE).** One `EventSource` per client connection - a mailbox, not a subscription list. What it carries is decided server-side by what that connection has attached. `mount()` runs on attach, its cleanup on detach. Each flush of an attached instance's updates (mvc batches per microtask) becomes one frame: `{ target, values }` with the version as the event id - the browser's reconnect resumes with `Last-Event-ID`; a server that lost the connection sends `reset`, and the client re-attaches.

MVP limits, on purpose: calls made while disconnected fail; one process.

## Transport

- **Calls are HTTP POST in both lanes** - one invocation path, so where an app puts its server logic is a matter of style. Request/response gives timeouts, retries, logs and proxies for free.
- **Push is SSE** - a one-way server stream over plain HTTP: native reconnect with `Last-Event-ID`, no dependency, the same code in Vite's middleware and the built server. Not a weaker WebSocket so much as the half a UI needs when calls already have a channel. Limits: text only; `EventSource` sends no custom headers (a connection id goes in the query); HTTP/1.1 caps ~6 connections per origin across tabs - HTTP/2 lifts it.
- **WebSocket later, if wanted** - versioned patches and call ids keep the protocol transport-agnostic, so a socket (one ordered duplex channel) can replace both without a change in meaning.

## Instance model

Reuse is decided per class by a key - no cached context tree. Direction agreed; details marked where still open.

- **Per call, not per tree.** A call's context is built per request: the request sits in `AsyncLocalStorage`, and `X.get()`/`X.use()` resolve within that call. Instances outlive calls only through keys, twins or process globals.
- **`static key(prefix)`** runs on every `X.use()` and returns a string or number, unique within the class. On a miss the new instance is stored under that key; the next `use()` producing it reuses the instance. A key is never sent by the client - `key()` runs on the server and reads only what the server trusts.
- **Prefix accumulates down the route walk** (explored, current direction). Each layer's prefix is `hash(parent key + concrete segment)`; the default key returns the prefix unchanged, and a route default's key becomes its children's prefix. One rule, three behaviours by what `key()` returns:
  - *inherit* - no key: one instance per concrete route location (params differ, the query string does not);
  - *narrow* - append to the prefix (an identity, a grant): everything below differs by it;
  - *reset* - drop the prefix (`static key() { return "docs" }`): everything below is shared regardless of what is upstream; upstream keys still run, so their gates still apply.
- **Ownership by prefix.** A key starting with its prefix is owned by the upstream entry and evicted with it - the cascade follows route nesting. Any other key is unowned: shared, with a TTL.
- **Reachable only by walking.** A layer's prefix exists only after the layer above ran its `key()` in this request, so no code can address a subtree it is not standing in. Hashing adds fixed length, no separator ambiguity and opacity in logs - not secrecy; keys never leave the server.
- **The un-nudged default is shared.** With no identity layer, a location's State is common to every visitor. An app's root key decides identity once for everything below; the starter should carry one.
- **TTL** defaults to 0: the grace period after the last reference (in-flight calls, attached twins). Caching across calls is opt-in per class.
- **`static use`** - the full-control override when reuse needs spelling out; `key` is the common case dev's default `use` consults.
- **Process globals** are not keys: `static global`, created at module scope (e.g. an OAuth client). Reached from either lane.
- **Owned members** (`cart = new Cart()`) never run `key()` - their lifetime is their owner's. Most server State should be owned members rather than free keyed instances.
- **Request data** is read in methods, `key()` and `use()` (`Cookies.get()`), never in a getter or field of a reused instance: mvc caches prototype getters as computed values, and a field on a recycled instance would hold the request that created it.

## Boundaries

- **Where:** a server module is `api.ts` (or under `app/api/`); everything else is client. An import from one is a stub or a twin - visible at the import site.
- **What crosses, decided at build:** the scanner reads the source, TS modifiers included, and emits the allowlist both sides use. Callable: public `async` methods and exported `async` functions. Server-only: TS `protected`/`private`, `_`-prefixed and `#private` members, lifecycle and State's own names. The call dispatcher accepts nothing outside the allowlist, so the boundary never rests on runtime visibility.
- **Refuse to build what the client cannot have.** A public sync method (every call is async over the wire) and a public `_`-prefixed member (unmanaged, so never replicated) are build errors. `protected`, `private` and `#private` members are free - they never cross. Linters can warn earlier, later.
- **No ceremony.** No wrapper, no client-view types. Read-only values and no-extension are runtime rules, not editor ones: assigning a twin field throws; a client `new` or `extends` of a twin class throws and is a documented anti-pattern. Writes go through server methods.
- **Guidance - server for truth, client for touch.** Server State: what is authoritative, shared, secret, or near the data (domain entities, permissions, live and collaborative data, views over large data) - it replaces client fetch-and-cache. Client State: what is ephemeral interaction (open menus, focus, drag, unsaved drafts, animation). Never hold one value in both - derive on the client from the twin. Lean server-heavy for internal tools and collaborative apps; lean client-heavy for latency-critical or offline-tolerant editors and for anonymous high-traffic pages, where per-visitor server memory costs most.

## Focus

What the server pushes should follow what the client looks at. Three grains, coarse to fine:

1. **Mount (MVP).** A twin attaches when its `X.use()` mounts and detaches on unmount.
2. **Demand.** A twin attaches when something first pulls it (`get()`, `use()`, a rendered read) and detaches when nothing does - route entry only makes it available. Per key, the client knows which fields some mounted observer reads: mvc's observer already holds each listener's key set (`@expressive/mvc/observable`). Sent upstream as `focus { target, keys }`, it lets the server stream only demanded keys and skip computing undemanded getters - the lazy-getter idea, server and client alike.
3. **Visibility.** A hidden tab (`visibilitychange`) pauses its stream; showing it resumes from the last version.

Demand wants an mvc seam - notice when a key gains its first observer or loses its last - rather than dev reading observer internals. That primitive also gives core lazy getters. Upstream, after the MVP.

## Server lifecycle

| Hook | Runs | Throwing |
|---|---|---|
| `static key(prefix)` | every resolution - each request on the walk, each `X.use()` | denies the request; nothing is created |
| `new()` | once, on creation (a key miss) | creation fails; the triggering call gets the reply |
| `use()` (instance) | every pass of a server-resolved instance: attach and each call - per request, as the client's runs per render | denies that request |
| `mount()` | each time a twin attaches, then on every instance it owns, parent first; returns a cleanup, run in reverse when that twin detaches | the attach is refused; the client Route can catch or redirect |

- Server and client `use()` do not collide: `api.ts` bodies never ship to the client, whose twin runs mvc's own per-render hook.
- `use()` returns nothing; the instance learns it was reached.
- No middleware hook - gating is `key()`, `new()` and `use()` throwing. An integration (OAuth) is a service the route forwards to, not a hook that inspects every request.
- References are not owned: `route = get(Route)` gets no `mount()` of its own.
- **Never callable:** lifecycle names (`new`, `use`, `mount`), State's own (`get`, `set`), `_`-prefixed and `#private` members.

## Reliability

Principles the MVP must not contradict; most land after it.

- **Server twins are a cache over durable data.** Deploys, crashes and restarts drop in-memory State; anything that must survive lives in the app's store, and `new()` can rebuild from it.
- **Versioned patches, call ids.** Each patch carries a version; each reply names the version it produced; each call an id the server dedupes. Ordering then holds across channels and retries.
- **Stale, not frozen.** A client `Connection` State reports `connecting`/`open`/`reconnecting`/`offline`/`closed` (with reason). Disconnected twins keep last-known values and flag themselves stale; they suspend only before their first snapshot.
- **Calls fail loudly.** Offline calls queue up to a timeout, then reject with a typed `ConnectionError`; per method or per call, an app chooses fail-fast or wait. Strict routes may opt in to a disconnect reaching their `Catch`.
- **Resumed or reset.** Reconnecting within the instances' TTL on the same process replays what was missed; otherwise twins are rebuilt through `new()` and `Connection` reports `reset` so the app can reconcile local edits.
- **Server-initiated close.** Logout, expiry or revocation closes with a reason (`closed: unauthorized`); long-lived streams re-check their session periodically.
- **Network.** Heartbeats inside load-balancer idle timeouts; reconnect with exponential backoff and jitter; reconnect on visibility change.
- **Scale.** One process first. More need sticky routing by connection or key; cross-instance state is the app's store.

## Later

- **TTL sweeper.** One per process; best effort. Evicting an entry evicts the keys it owns.
- **Warm rehydration.** A State that packs its managed values into a token (JWT) or store and restores from it on a key miss - the same serialise/restore twins need for snapshots. Hot = in memory; warm = rebuilt without the source of truth; cold = the source of truth or the user. Stateless tokens cannot be revoked before expiry.
- **`app/api/**` lane.** Calls from the bundled client work as in the MVP, walked from `app/api`'s own root. For external clients: per-request identity (bearer), a `Call` State for HTTP concerns (headers, status, cookies; `Fetch` considered - its instance name shadows global `fetch()`), the reply pipeline (string → `text/plain`, `undefined` → 204, other values → JSON, status helpers, data primitives; uncaught → 500, message in dev only), REST as `protected` uppercase verbs on dev's `Route` (params from `this.match`, body as the one parameter), HTML replies via a server DOM shim, OpenAPI.
- The Reliability items above beyond the MVP.
- **Build notice.** `expressive build` prints one line per non-root route module kept in the main bundle and why - e.g. it exports `Catch`; a `Catch` on its section's `index` covers it.
- **Repo placement.** dev incubates here as a trunk while it drives changes into mvc and dom; it is the likeliest package to move to `gabeklein/expressive-dev` at its first release, once its PRs stop touching core.

## Rejected

- **Scoped `X.use()` in a `Layout`**, with `undefined` rendering `children`. A route's State belongs in its `default` class - the one place a route declares what it provides.

## Explored on the way

Ideas the instance model replaced, kept so they are not re-proposed blind.

- **Cached context tree** (session → tab → location contexts, forked per key, each a cache): high upkeep for little saving - real savings are database and API reads, which a class key gets directly.
- **Identity provider as dev's seam** (a `Session` class, or an `App.use()` returning a session key, as middleware): session is the app's concern.
- **`use()` returning an instance handed down to the next layer** (memo-like): superseded by `static key`.
- **Key as a tuple scoped by an instance**: keys stay plain and unique per class; `key()` salts them itself.
- **Scope as an object** (`{ session, tab, path }`): dev asserting a shape; the prefix is one opaque string with one purpose.
- **`key = false` for process globals**: globals are `static global` at module scope instead (Agreed shape).
- **TTL defaulting to Infinity**: 0 - lifetime capped by whatever references the instance.
- **`static provider = github({...})`** on an account class: an OAuth client is its own process global.
- **An integration self-handling its callback** by inspecting every request: the route forwards to it.
- **`.expressive` endpoint prefix**: not needed for calls.
- **`per(Type)` for request-scoped fields**: open to it, but a class-level override telling `get` where an instance comes from is preferred - parked (Open).
- **Requiring `default` classes to extend `Route`**: what is special is position (constructed per layer, given the prefix, `use()` per pass), not class; `key` applies to any State. Revisit if a feature needs Route's members.

## Open

- Status helper naming - `NotFound` and `Redirect` collide with existing exports. Leaning `Status.NotFound(...)`.
- Wire shape. Leaning: calls POST to the route path (the location part of the prefix) with a header naming the call (a function or `default.method`), args as the JSON body. A per-page-load connection id for push and detach is proposed - transport, not identity - and not yet agreed. Also: patch frames; ids for nested twins (owner key + property path proposed); what counts as serializable (Date, Map, class instances).
- `key()` returning nothing - proposed to throw rather than fall back.
- Instance `use()` cascading to owned members - by default, or opted into with `super.use()`.
- Request-scoped fields on reused instances - a class-level `get` override, a `Context` seam, or `per()`.
- How a server `Route`'s `match` is provided by the walk.
- Auth needs an `app/api` slice (GET, `Set-Cookie`, redirect) for an OAuth callback - whether it joins the MVP.
- Optimistic writes - a follow-up decision. If ever: local writes rebased on incoming versions until acknowledged, rolled back on rejection.
- Demand as an mvc primitive - see Focus.
- Reliability defaults: timeouts, the per-call wait-or-fail option, the strict-route flag, replay buffer size.
- Hot reload retiring keyed instances.
- Client parity for the `mount()` cascade: the server needs it (owned helpers have no other attach signal), so the maintainer cascades on the client too, upstream.
- Whether an `app/api/**` default (a REST `Route`) is twinned when the bundled client imports it, and what a twin of a `Route` subclass carries.
- On the client only the layout chain stays mounted - sibling pages remount (per the generated route tree). Twins inherit that lifetime.

## Upstream (bullpen)

- mvc #473: `State.new(true)` as explicit opt-in to process globals - not a prerequisite.
- mvc: demand notification - a key gaining its first or losing its last observer. Enables focus grain 2 and lazy getters.
- dom: optional `rendering?()` on `HostRuntime` - approved in shape, unused until dom renders in a server process.
- dom: string renderer + style collector. Replaces the item-9 shim.
- router: `@jsxImportSource @expressive/mvc` pragma on `link`/`nav`/`route` (on the trunk as a stopgap commit).
- dom: #454 parent-first ordering (0.21 kB). React: keep uncommitted State across retries.

## Release gates

- 100% coverage like every package - dev's `coverage` script runs vitest without `--coverage` until then.
- `skills/` docs, changeset, `private: false`.
- Router stopgap replaced by its upstream PR.
- The example's E2E specs run in CI.
