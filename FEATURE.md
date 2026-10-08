# @expressive/dev

Next-like host for Expressive: Vite, `@expressive/dom` rendering, file-based routes, a server lane. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/dev-server` is the trunk. Each feature lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Upstream fixes (mvc, dom, router) land on `main` as their own PRs, never only here.
- `backup/dev-server-full` holds the pre-trunk prototype - source for the queued features below. Its POST dispatch and client stubs seed the MVP; its `app/api` lane comes later. Delete once nothing is left to carve.

## Agreed shape

- **One surface.** The root export has `browser` and `default` (server) builds with identical names. `serve` is real on the server, throws in the browser.
- **Turnkey.** dom, router, inspect are dependencies; `@expressive/mvc` is the only peer.
- **JSX.** `jsxImportSource: "@expressive/dev"` - dev's runtime re-exports dom's.
- **Router.** dev exports its own `Router` (extends `BrowserRouter`) and `Route`, plus `Link`, `NavLinks`, `Redirect`. No `BrowserRouter` export.
- **Config.** `index.ts` default-exports `config({...})`, read on the server.
- **Server modules, one model.** Sidecars (`app/**/api.ts`) and `app/api/**` share one invocation path from the bundled client and one ambient model. They differ in location binding (a sidecar runs in its folder's location context) and twins (a sidecar's default is demanded per location). What the caller is - a bundled tab or an external client - decides ambient context, not which folder the module sits in.
- **dom on the server.** Needed for JSX rendered to HTML (responses, emails), not SSR.
- **Monkey-patch first.** Where mvc or an adapter lacks a seam, dev patches it in one file, replaced when upstream catches up. Stress-tests the concept before committing upstream.
- **Server `get`/`use` are dev's, permanently.** Request-scoped resolution is a host concern - no core or dom change. The server build replaces `State.get`/`State.use` (installed after dom evaluates, asserted at boot) and overrides only the no-argument `Context.get()`; the client keeps dom's behavior.
- **Process globals stay core's.** `static global` with a module-scope `X.new()` registers in the real root, untouched by requests. Opt-in sugar for this (#473) is the maintainer's call and blocks nothing here.

## Landed

- Basics - `app/` route tree (`Page`, `Layout`, `Loading`, `Catch`, `NotFound`), single-file `app.tsx` mode, virtual shell/entry/router module, dev server with inspect, client + node service build, static `serve` with `index.html` fallback, example workspace.
- Route chunks - a module exporting only `Page`/`Layout`/`NotFound` (not the root) loads on first entry; `Loading` and `Catch` keep a module static.
- Route defaults - a page module's `default` function is its entry hook (runs with the Route before it renders, may be async; a returned string redirects, `null` forfeits to the 404). A `default` class - State or Component alike - renders around the route's content (`<X>{children}</X>`, or `<X><Layout /></X>` with a `Layout`) and is provided to everything below it. A module with a `default` stays a static import.
- Loading - a module's `Loading` fills its `Layout`'s content slot: every route rendered there gets it as its `fallback`, at any depth until a nested `Layout` starts a fresh slot; a page's own `Loading` covers that page first. It shows when a page cannot show anything yet - chunk, entry hook or data - which in practice means a cold arrival, since in-app navigation holds the current page. dev's `Route` owns no boundary by default (`fallback = false`, `catch` only with a `Catch`), so a page class's waits reach the slot; generated routes always declare theirs, `null` where no `Loading` applies.
- E2E harness - `example/e2e/` Playwright specs run against the dev server and the built service (`bun run e2e` in `example/`). Each feature adds its page and spec. Not in CI yet: trunk PRs run `verify` only.

## MVP

Enough to write E2E tests and examples and feel the ergonomics. One PR each, in order. Everything under Later waits until the MVP has been used.

1. **Sidecar calls.** Each export of `app/**/api.ts` becomes a browser stub that POSTs `{ location, name, args }` with the tab id. The server resolves session → tab → location (below) and runs the function there in `AsyncLocalStorage`, so `T.get()`/`T.use()` resolve in that context; both throw outside a call. JSON reply. Importable only from the sidecar's folder and below (build error otherwise).
2. **Twins (pull).** A sidecar's default class is demanded per location: created in the tab's location context, its twin provided in the client scope, so `Foo.get()` in that route's pages returns the twin. On route entry the twin POSTs `attach { location }`: the server gets-or-creates the instance, adds it to the tab's attached set, and replies with a snapshot and its version - suspending until then. Route exit POSTs `detach`. Methods are calls; a reply carries the call's patch and version, applied before the call resolves - an awaited call never sees a stale twin. Twins are read-only - an invariant, not an MVP shortcut: server values change through methods, and assigning a twin field throws.
3. **Push (SSE).** One `EventSource` per tab - a mailbox, not a subscription list. What it carries is decided server-side by the tab's attached set, so attaching or detaching never touches the stream. `mount()` runs on attach, its cleanup on detach. Each flush of an attached instance's updates (mvc batches per microtask) becomes one frame: `{ target, values }` with the version as the event id - the browser's reconnect resumes with `Last-Event-ID`; a server that lost the tab sends `reset`, and the client re-attaches.
4. **Identity.** Default cookie session (HttpOnly, `SameSite=Lax`, `Secure` in production, minted lazily); tab id in `sessionStorage`. No user layer, no login rotation yet.

MVP limits, on purpose: twins live until their tab context goes (no TTL sweeper); calls made while disconnected fail; one process; the default cookie provider only.

## Transport

- **Calls are HTTP POST in both lanes** - one invocation path, so where an app puts its server logic is a matter of style. Request/response gives timeouts, retries, logs and proxies for free.
- **Push is SSE** - a one-way server stream over plain HTTP: native reconnect with `Last-Event-ID`, no dependency, the same code in Vite's middleware and the built server. Not a weaker WebSocket so much as the half a UI needs when calls already have a channel. Limits: text only; `EventSource` sends no custom headers (tab id goes in the query); HTTP/1.1 caps ~6 connections per origin across tabs - HTTP/2 lifts it.
- **WebSocket later, if wanted** - versioned patches and call ids keep the protocol transport-agnostic, so a socket (one ordered duplex channel) can replace both without a change in meaning.

## Ambient model

The axis is the caller, not the folder.

| | Bundled tab (sidecar or `app/api`) | External client (`app/api` only - later) |
|---|---|---|
| Identity | session cookie + tab id | cookie or bearer, per request |
| Context | session → tab → location (sidecar) or tab (`app/api`) | per request only |
| Twins, `mount()` | yes - attach and detach via SSE | none |
| `new()` | once, on creation in its context | once, per request |
| `ttl = 0` instances | end with the call | end with the request |
| Instance `use()` | never on the server | never on the server |

```
Context.root          process globals (static global)
└ session ctx         cookie - one browser
  └ tab ctx           tab id - X.use() defaults land at or below here
    └ location ctxs   one per concrete path segment the tab has entered
      └ call ctx      ttl-0 instances
```

- **Keyed by location, not pattern.** `/blog/a/settings` and `/blog/b/settings` are different pages with different state (which post is loaded), so each concrete segment gets its own context, and its `Route` keeps a fixed `match`.
- **Contexts are reachable only through the caller's identity**, never by key.
- **Tab identity.** Minted client-side (`crypto.randomUUID()`), kept in `sessionStorage` - per tab, survives reload. Looked up as (session, tab id), so not a credential. "Duplicate tab" copies `sessionStorage`: a second live stream presenting a connected id gets a fresh id. Without a session, tab contexts hang under root.

## Boundaries

- **Where:** a server module is `api.ts` (or under `app/api/`); everything else is client. An import from one is a stub or a twin - visible at the import site.
- **What crosses, decided at build:** the scanner reads the source, TS modifiers included, and emits the allowlist both sides use. Callable: public `async` methods and exported `async` functions. Server-only: TS `protected`/`private`, `_`-prefixed and `#private` members, lifecycle and State's own names. The call dispatcher accepts nothing outside the allowlist, so the boundary never rests on runtime visibility.
- **Refuse to build what the client cannot have.** A public sync method (every call is async over the wire) and a public `_`-prefixed member (unmanaged, so never replicated) are build errors. `protected`, `private` and `#private` members are free - they never cross. Linters can warn earlier, later.
- **No ceremony.** No wrapper, no client-view types. Read-only values and no-extension are runtime rules, not editor ones: assigning a twin field throws; a client `new` or `extends` of a twin class throws and is a documented anti-pattern. Writes go through server methods.
- **Guidance - server for truth, client for touch.** Server State: what is authoritative, shared, secret, or near the data (domain entities, permissions, live and collaborative data, views over large data) - it replaces client fetch-and-cache. Client State: what is ephemeral interaction (open menus, focus, drag, unsaved drafts, animation). Never hold one value in both - derive on the client from the twin. Lean server-heavy for internal tools and collaborative apps; lean client-heavy for latency-critical or offline-tolerant editors and for anonymous high-traffic pages, where per-visitor server memory costs most.

## Focus

What the server pushes should follow what the client looks at. Three grains, coarse to fine:

1. **Location (MVP).** Route entry attaches a sidecar's twin; exit detaches it.
2. **Demand.** A twin attaches when something first pulls it (`get()`, `use()`, a rendered read) and detaches when nothing does - route entry only makes it available. Per key, the client knows which fields some mounted observer reads: mvc's observer already holds each listener's key set (`@expressive/mvc/observable`). Sent upstream as `focus { target, keys }`, it lets the server stream only demanded keys and skip computing undemanded getters - the lazy-getter idea, server and client alike.
3. **Visibility.** A hidden tab (`visibilitychange`) pauses its stream; showing it resumes from the last version.

Demand wants an mvc seam - notice when a key gains its first observer or loses its last - rather than dev reading observer internals. That primitive also gives core lazy getters. Upstream, after the MVP.

## Server lifecycle

| Hook | Runs | Throwing |
|---|---|---|
| `new()` | once, on creation in its context | creation fails; the triggering call gets the reply |
| `mount()` | each time a twin attaches, then on every instance it owns, parent first; returns a cleanup, run in reverse when that twin detaches (route exit, tab close) | the attach is refused; the client Route can catch or redirect |
| `use()` (instance) | never - client-only, as the per-render argument hook | - |

- Static `X.use()` stays: dev's get-or-create in the current context.
- No per-route middleware hook - gating is identity upstream plus a State's own `new()`/`mount()`.
- References are not owned: `route = get(Route)` gets no `mount()` of its own.
- Each location context holds a server-side `Route` with that location's `match`, so `get(Route)` resolves in sidecar States and their helpers.
- **Never callable:** lifecycle names (`new`, `use`, `mount`), State's own (`get`, `set`), `_`-prefixed and `#private` members.
- Methods run in their instance's context without re-gating per call; ending a session destroys its subtree, which drops its twins, so the client re-enters.

## Reliability

Principles the MVP must not contradict; most land after it.

- **Server twins are a cache over durable data.** Deploys, crashes and restarts drop in-memory State; anything that must survive lives in the app's store, and `new()` can rebuild from it.
- **Versioned patches, call ids.** Each patch carries a version; each reply names the version it produced; each call an id the server dedupes. Ordering then holds across channels and retries.
- **Stale, not frozen.** A client `Connection` State reports `connecting`/`open`/`reconnecting`/`offline`/`closed` (with reason). Disconnected twins keep last-known values and flag themselves stale; they suspend only before their first snapshot.
- **Calls fail loudly.** Offline calls queue up to a timeout, then reject with a typed `ConnectionError`; per method or per call, an app chooses fail-fast or wait. Strict routes may opt in to a disconnect reaching their `Catch`.
- **Resumed or reset.** Reconnecting within the tab's TTL on the same process replays what was missed; otherwise twins are rebuilt through `new()` and `Connection` reports `reset` so the app can reconcile local edits.
- **Server-initiated close.** Logout, expiry or revocation closes with a reason (`closed: unauthorized`); long-lived streams re-check their session periodically.
- **Network.** Heartbeats inside load-balancer idle timeouts; reconnect with exponential backoff and jitter; reconnect on visibility change.
- **Scale.** One process first. More need sticky routing by session or tab; cross-instance state is the app's store.

## Later

- **TTL.** Optional `static ttl` (seconds) seeds a managed instance `ttl` (a deadline; reads as remaining life). A `use()` retrieval resets it; `ttl = 0`, the default, lives until the current call ends; an attached twin keeps its instance alive. One sweeper per process; best effort.
- **Cleanup.** A cached context counts its live States, attached twins and in-flight calls; at zero it pops and leaves its parent. Ending a session destroys its subtree. `Context.pop()` does not destroy instances, so dev tracks and destroys what it created.
- **User layer.** An optional provider hook maps a session to a user key, placing session contexts under that user's context; login's required id rotation mints the new session context there. Carrying anonymous state across login is app logic.
- **`app/api/**` lane.** Calls from the bundled tab work as in the MVP (no location binding). For external clients: per-request identity (bearer), a `Call` State for HTTP concerns (headers, status, cookies; `Fetch` considered - its instance name shadows global `fetch()`), the reply pipeline (string → `text/plain`, `undefined` → 204, other values → JSON, status helpers, data primitives; uncaught → 500, message in dev only), REST as `protected` uppercase verbs on dev's `Route` (params from `this.match`, body as the one parameter), HTML replies via a server DOM shim, OpenAPI.
- The Reliability items above beyond the MVP.

## Rejected

- **Scoped `X.use()` in a `Layout`**, with `undefined` rendering `children`. A route's State belongs in its `default` class - the one place a route declares what it provides.

## Open

- Status helper naming - `NotFound` and `Redirect` collide with existing exports. Leaning `Status.NotFound(...)`.
- Wire shapes: call and attach endpoints, `{ location, name, args }`, patch frames; ids for nested twins; what counts as serializable (Date, Map, class instances).
- Optimistic writes - a follow-up decision. If ever: local writes rebased on incoming versions until acknowledged, rolled back on rejection.
- Demand as an mvc primitive - see Focus.
- Session and tab details: cookie name, minting, provider export form; tab context lifetime after its stream closes; whether a duplicated tab forks state or starts fresh.
- Reliability defaults: timeouts, the per-call wait-or-fail option, the strict-route flag, replay buffer size.
- Hot reload retiring location contexts and their instances.
- Client parity for the `mount()` cascade: the server needs it (owned helpers have no other attach signal), so the maintainer cascades on the client too, upstream.
- Whether an `app/api/**` default (a REST `Route`) is twinned when the bundled client imports it, and what a twin of a `Route` subclass carries.

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
