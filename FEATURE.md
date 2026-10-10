# @expressive/dev

Next-like host for Expressive: Vite, `@expressive/dom` rendering, file-based routes, a server lane. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/dev-server` is the trunk. Each feature lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Upstream fixes (mvc, dom, router) land on `main` as their own PRs, never only here.
- `backup/dev-server-full` holds the pre-trunk prototype - source for the queued features below. Its POST dispatch and client stubs seed the MVP; its `app/api` lane comes later, moved to `api/` beside `app/`. Delete once nothing is left to carve.
- Stack PRs: each targets the previous one's branch, the bottom one the trunk; merge a lower branch up into the ones above it as it moves.
- Verify in a browser, not only unit tests: `bun run example:e2e` in `packages/dev` (set `CHROME`). After rebuilding a package, a dev server can serve a stale `@expressive/*` from `example/node_modules/.vite` - delete it (the E2E dev project always does).
- Specs live in `example/e2e/` for now; colocating them beside routes is allowed later - the dependency scan already skips `*.spec.*`/`*.test.*` under `app/`.
- Trunk commits carry no trailers.

## Agreed shape

- **Two entries.** The root export holds what client and server share. Server-only API (`config`, `serve`, `Current`) is `@expressive/dev/server`, so a client import fails at build rather than at call.
- **Turnkey.** dom, router, inspect are dependencies; `@expressive/mvc` is the only peer.
- **JSX.** `jsxImportSource: "@expressive/dev"` - dev's runtime re-exports dom's.
- **Router.** dev exports its own `Router` (extends `BrowserRouter`) and `Route`, plus `Link`, `NavLinks`, `Redirect`. No `BrowserRouter` export.
- **Config.** `index.ts` default-exports `config({...})` from `@expressive/dev/server`, read on the server.
- **Server modules, one model.** Sidecars (`app/**/remote.ts`) and `api/**` (a peer of `app/`) share one invocation path from the bundled client and one context model (below). `api/` has its own root; a sidecar call never passes through `api/index.ts`. Process globals are the only layer both lanes share.
- **Session is the app's concern.** dev does not detect or mint sessions or tabs; an app expresses identity through keys (Context model). Recipes may come later.
- **dom on the server.** Needed for JSX rendered to HTML (responses, emails), not SSR.
- **Monkey-patch first.** Where mvc or an adapter lacks a seam, dev patches it in one file, replaced when upstream catches up. Stress-tests the concept before committing upstream.
- **Server `get`/`use` are dev's, permanently.** Request-scoped resolution is a host concern - no core or dom change. mvc core has no static `get`/`use` - adapters install them; the server installs its own over dom's (after dom evaluates) in the dev host and the built service; the client keeps dom's.
- **Process globals stay core's.** `static global` with a module-scope `X.new()` registers in the real root, untouched by requests. Opt-in sugar for this (#473) is the maintainer's call and blocks nothing here.

## Landed

- Basics - `app/` route tree (`Page`, `Layout`, `Loading`, `Catch`, `NotFound`), single-file `app.tsx` mode, virtual shell/entry/router module, dev server with inspect, client + node service build, static `serve` with `index.html` fallback, example workspace.
- Route chunks - a route module (not the root) loads on first entry, `default` included - an entry hook loads its module, then runs; a class resolves from it. `Loading` and `Catch` keep a module static: they must be on hand before anything below them waits or fails.
- Route defaults - a page module's `default` function is its entry hook (runs with the Route before it renders, may be async; a returned string redirects, `null` forfeits to the 404). A `default` class - State or Component alike - renders around the route's content (`<X>{children}</X>`, or `<X><Layout /></X>` with a `Layout`) and is provided to everything below it.
- Loading - a module's `Loading` fills its `Layout`'s content slot: every route rendered there gets it as its `fallback`, at any depth until a nested `Layout` starts a fresh slot; a page's own `Loading` covers that page first. It shows when a page cannot show anything yet - chunk, entry hook or data - which in practice means a cold arrival, since in-app navigation holds the current page. dev's `Route` owns no boundary by default (`fallback = false`, `catch` only with a `Catch`), so a page class's waits reach the slot; generated routes always declare theirs, `null` where no `Loading` applies.
- E2E harness - `example/e2e/` Playwright specs run against the dev server and the built service (`bun run example:e2e` in `packages/dev`). Each feature adds its page and spec. Not in CI yet: trunk PRs run `verify` only.
- Sidecar calls - each `async` export of a route folder's `remote.ts` is a browser stub POSTing to the folder's path (Wire below); dispatched on Vite's module runner in dev and baked into `dist/server` at build. The build refuses any other export; only the folder and below may import it. A thrown error's message reaches the client in dev only.
- Errors - an exported class with `extends` is an error class: the client stub is a class of the same name, and a thrown instance (or subclass) is rebuilt as it - `instanceof`, message and own fields - with a `status` field in 400-599 as the reply status. Verified as an `Error` at the first dev call and at service boot.
- Call context - each call walks its sidecar's concrete path, each segment a cached layer `Context` keyed `hash(parent prefix + segment)`, and runs in `AsyncLocalStorage`. `X.use()` makes or finds the one `X` at the call's layer - built in a child context, so its `get()` fields resolve upward, and provided to the layer: `X.get()` finds the nearest at the call's layer or above, and a deeper `use()` shadows. It lives while a call holds it, then `static ttl` seconds (default 300); its destroy (`set(null)`) drops it. A layer lives while a call, an instance or a child layer does. `Current` (root layer) reads the call's request live. Route defaults as layer occupants come with the twin (below).
- Remote folders and the allowlist - `remote.ts`, or a `remote/` folder (any depth, `index` optional), belongs to its parent folder's context; `remote/` is never routed, and both in one folder fail the build. A call names its module (`feed/latest:add`; plain `add` for the entry). Only what the client imports is callable - the stubs the browser loaded in dev, those the client build generated in production; the server build reuses that list. Production ids are hashes salted per build, `remote: { opaque: false }` in `index.ts` to opt out.
- RPC twin - a remote entry's `default` State class is its folder's seat: each call's walk seats it in the folder's layer, `key()` (no prefix; `undefined` passes through; throwing denies) narrows that layer and everything below, and its end evicts them. Its public `async` methods are `default.<method>` calls on the seated instance; the client stub's default is a twin class of them, and the route tree provides it around the folder's routes. A default in a nested `remote/` module, or a public sync method, fails the build. Methods only - no values yet.
- Twin members through `extends` - the scan follows a seat's bases by import, reading source or a package's `.d.ts`, up to `@expressive`'s classes; the nearest declaration's modifiers win. Inherited public `async` methods are calls; public fields and getters are recorded for twin values. A base it cannot follow (an expression, an unresolved import, a non-class export) fails the build.

## MVP

Enough to write E2E tests and examples and feel the ergonomics. Complete with the twin (Landed); everything under Later waits until the MVP has been used.

MVP limits, on purpose: calls made while disconnected fail; one process.

## Planned after the MVP

Not built yet, but the MVP must not cut against them.

- **Twin values - eager, with push.** A plain read off a twin is synchronous and announces nothing, so values cannot wait on demand. A twin attaches when created (the route provides it), receives a snapshot of every public value its class's scan lists, and suspends until then; every flush of an attached instance is pushed (below), and each call's reply carries what that call changed, so an awaited call never sees a stale twin. Attachment follows the twin instance, not its readers - `property = get(Remote)`, `Remote.get()` and `get(cb)` subscribers all read the one instance the route provides.
- **Values invariant.** What TypeScript shows as public is readable on the twin with no separate mechanism, and stays fresh: every public value is present before the first read and re-sent on change. The scan's fields are the allowlist - TS `private` is erased at runtime, so a snapshot of the live instance would leak it.
- **Twins via client `X.use()`.** Client `X.use()` of a server class - a route's `default` or any component - attaches a twin for that mount and detaches on unmount. The server resolves the instance through the class's key; the reply carries a snapshot and version, and the twin suspends until then. Methods are calls; a reply carries the call's patch and version, applied before the call resolves - an awaited call never sees a stale twin. Twins are read-only - an invariant, not a shortcut: server values change through methods, and assigning a twin field throws.
- **Push (SSE).** One `EventSource` per client connection - a mailbox, not a subscription list. What it carries is decided server-side by what that connection has attached. `mount()` runs on attach, its cleanup on detach. Each flush of an attached instance's updates (mvc batches per microtask) becomes one frame: `{ target, values }` with the version as the event id - the browser's reconnect resumes with `Last-Event-ID`; a server that lost the connection sends `reset`, and the client re-attaches. An evicted context sends its attached twins a terminal event before their stream drops them.
- **OAuth** - not built, anticipated: an `api/` slice (GET, `Set-Cookie`, redirect) for the callback, forwarding to a process-global client.

## Transport

- **Calls are HTTP POST in both lanes** - one invocation path, so where an app puts its server logic is a matter of style. Request/response gives timeouts, retries, logs and proxies for free.
- **Push is SSE** - a one-way server stream over plain HTTP: native reconnect with `Last-Event-ID`, no dependency, the same code in Vite's middleware and the built server. Not a weaker WebSocket so much as the half a UI needs when calls already have a channel. Limits: text only; `EventSource` sends no custom headers (a connection id goes in the query); HTTP/1.1 caps ~6 connections per origin across tabs - HTTP/2 lifts it.
- **WebSocket later, if wanted** - versioned patches and call ids keep the protocol transport-agnostic, so a socket (one ordered duplex channel) can replace both without a change in meaning.

## Wire

```
POST /blog/a                      the sidecar folder's path, current params filled in
x-expressive-call: default.flip   an export's name - module:name inside remote/, default.<method> - or its build hash
content-type: application/json

["arg1", 2]                       the argument array
```

- **Path.** `app/blog/[slug]/remote.ts` → `/blog/a`; the root sidecar is `POST /`. The stub knows its folder's pattern from the generator and fills it from the current route match - the import rule guarantees the params exist. The folder, not the caller's deeper location: the walk runs `key()` down to the module's own layer, so calls from any page below land in the same context. The query string is ignored.
- **Ids.** Readable in dev (`add`, `feed/latest:add`; error classes `/<folder>#<module:Class>`). Production hashes each with a per-build salt: no names on the wire or in the bundle's call sites, and a tab from an older build gets 404 rather than calling changed code. `remote: { opaque: false }` keeps readable ids, so a v1.0.0 client still works against v1.0.1 while names hold.
- **Not a public API.** Remote calls exist for the bundled client; `api/**` is the lane meant to be called by hand. The allowlist - not the URL or header, which any sender controls - is the boundary.
- **A call is a POST with `x-expressive-call` and `content-type: application/json`.** Anything else falls through (GET still serves the app). Same-origin calls cost no preflight; a cross-site form cannot send either, and a cross-site script sending them triggers a preflight the server does not approve - so a forged call never arrives, whatever cookies the app uses.
- **Reply.**

  | Outcome | Status | Body |
  |---|---|---|
  | value | 200 | the value as JSON |
  | `undefined` | 204 | none |
  | name not in the allowlist, or no such module | 404 | the same for both |
  | malformed body | 400 | `{ message }` |
  | an instance of an exported `Error` subclass | its `status` field in 400-599, else 500 | `{ error: "/<folder>#<Class>", message, ...own fields }` |
  | anything else | 500 | production: a generic `message` only; development: `message` and the stack |

- **Values are plain JSON** in the MVP. Not on the wire yet: a connection id (push and detach), versions and patches (twin values), call ids (Reliability).

## Context model

Cached contexts, keyed. Each route layer resolves a cached `Context`; per-request data never enters one. Direction agreed; details marked where still open.

- **One cached `Context` per layer, keyed by that layer's key.** It holds what is built once: the layer's `default` instance (its only top-level occupant), the members it owns (mvc's `join` registers them into their owner's context), and any `X.use()` made at that layer. A later request is a map lookup per layer - nothing re-registers.
- **`static key()`** belongs to a layer's seat and runs on every walk through it. It returns a string, a number or `undefined`; `undefined`, or no `key`, passes the location through. It takes no prefix - dev composes. A key is never sent by the client: it reads verified data only - the request through `Current` (a signed cookie, a session lookup) or State seated above through `get()`. A key built from raw client data lets the client pick its context. Declare it `protected` so a twin's type does not show it; it never crosses at runtime.
- **Prefix accumulates down the route walk.** Each layer's prefix is `hash(parent prefix + concrete segment)`, then `hash(prefix + key)` if its seat keys. Two behaviours:
  - *inherit* - no key: one context per concrete route location (params differ, the query string does not);
  - *narrow* - a key (an identity, a grant): everything below differs by it.
- **Ownership is parentage.** Every context sits under its walk parent and sees upstream State through `get()`.
- **Reachable only by walking.** A layer's prefix exists only after the layer above ran its `key()` in this request, so no code can address a subtree it is not standing in. Hashing adds fixed length, no separator ambiguity and opacity in logs - not secrecy; keys never leave the server.
- **The un-nudged default is shared.** With no identity layer, a location's context is common to every visitor. An app's root key decides identity once for everything below; the starter should carry one.
- **Eviction is the root instance's end.** When dev seats a layer's instance it subscribes to its destroy (`set(null)`) and caches the context under the key. Destroying that instance - from a method, a poll, a disconnect - pops the context at once: owned State goes with it (`pop()` destroys State the context constructed from a class), the next request misses and rebuilds, and attached twins get a terminal event. dev seats defaults as classes so `pop()` destroys them.
- **Lifetime.** A context lives while anything in it does - in-flight calls, instances within their TTL (default 300 seconds, `0` to opt out), attached twins, child contexts. Its seat's end pops it and everything below; a `use()` instance never outlives its context.
- **`X.use()` is positional.** One instance per class per layer, made at the call's layer wherever `X` is defined; `key` plays no part. Provided to that layer, so `get()` finds it there and below; a deeper `use()` shadows. `get()` before any `use()` throws. Functions calling `use()` on one class share it - keep creation to one.
- **`static use`** - the full-control override when reuse needs spelling out.
- **Process globals** are not keys: `static global`, created at module scope (e.g. an OAuth client). Reached from either lane.
- **Owned members** (`cart = new Cart()`) never run `key()` - their lifetime is their owner's. Most server State should be owned members rather than free instances.

## Current

Per-request data sits behind one process-global `Current`, in context everywhere, whose accessors read `AsyncLocalStorage` (`{ request, connection, context }`, set by dev's walk) at call time: headers, cookies, the connection id, request and response tooling. Name open.

- **No per-request State.** `current = get(Current)` on any instance - reused or not - holds the one singleton, and every read reflects the request in progress. No `per()`, no reuse detection.
- **Live, not computed.** mvc caches a prototype getter as a computed value unless it has a setter, is non-configurable or is `_`-prefixed (`classify()` in `state.ts`); `Current`'s accessors use one of those (as `Component`'s `key` does) or are methods.
- **Rules that remain:**
  - do not copy a request value into a field of a reused instance;
  - an app getter reading `Current` is an mvc computed and caches - read it in methods, `key()` and `use()`;
  - outside a call (a push flush, a TTL sweep) `Current` throws; timers started inside a call keep that call's store.

## Boundaries

- **Where:** a server module is `remote.ts` or anything under a `remote/` folder (or under `api/`); everything else is client. An import from one is a stub or a twin - visible at the import site.
- **What crosses, decided at build:** the scanner reads the source, TS modifiers included, and emits the allowlist both sides use. Callable: public `async` methods and exported `async` functions. Server-only: TS `protected`/`private`, `_`-prefixed and `#private` members, statics (`key`, `ttl`), lifecycle and State's own names. The call dispatcher accepts nothing outside the allowlist, so the boundary never rests on runtime visibility.
- **Refuse to build what the client cannot have.** A public sync method (every call is async over the wire) and a public `_`-prefixed member (unmanaged, so never replicated) are build errors. `protected`, `private` and `#private` members are free - they never cross. Linters can warn earlier, later.
- **No ceremony.** No wrapper, no client-view types. Read-only values and no-extension are runtime rules, not editor ones: assigning a twin field throws; a client `new` or `extends` of a twin class throws and is a documented anti-pattern. Writes go through server methods.
- **Guidance - server for truth, client for touch.** Server State: what is authoritative, shared, secret, or near the data (domain entities, permissions, live and collaborative data, views over large data) - it replaces client fetch-and-cache. Client State: what is ephemeral interaction (open menus, focus, drag, unsaved drafts, animation). Never hold one value in both - derive on the client from the twin. Lean server-heavy for internal tools and collaborative apps; lean client-heavy for latency-critical or offline-tolerant editors and for anonymous high-traffic pages, where per-visitor server memory costs most.

## Focus

What the server pushes should follow what the client looks at. Three grains, coarse to fine:

1. **Mount.** A twin attaches when its `X.use()` mounts and detaches on unmount.
2. **Demand - opt-in only.** Not the default: a plain read has no observer, so streaming only observed keys would serve it stale values. A class may opt out a heavy field from pushes explicitly; demand is never inferred. Per key, mvc's observer already holds each listener's key set (`@expressive/mvc/observable`), should an opt-in want it.
3. **Visibility.** A hidden tab (`visibilitychange`) pauses its stream; showing it resumes from the last version.

An mvc seam - notice when a key gains its first observer or loses its last - would serve that opt-in and gives core lazy getters. Push does not need it. Upstream, optional.

## Server lifecycle

| Hook | Runs | Throwing |
|---|---|---|
| `static key()` | every walk through its seat's layer | denies the request; nothing is created |
| `new()` | once, on creation (a key miss) | creation fails; the triggering call gets the reply |
| `use()` (instance) | every pass of a server-resolved instance: attach and each call - per request, as the client's runs per render; cascades to owned members that define one, parent first (leaning), unless it returns `false` | denies that request |
| `mount()` | each time a twin attaches, then on every instance it owns, parent first; returns a cleanup, run in reverse when that twin detaches | the attach is refused; the client Route can catch or redirect |

- Server and client `use()` do not collide: `remote.ts` bodies never ship to the client, whose twin runs mvc's own per-render hook.
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
- **`api/**` lane.** Calls from the bundled client work as in the MVP, walked from `api/`'s own root. For external clients: per-request identity (bearer), a `Call` State for HTTP concerns (headers, status, cookies; `Fetch` considered - its instance name shadows global `fetch()`), the reply pipeline (string → `text/plain`, `undefined` → 204, other values → JSON, status helpers, data primitives; uncaught → 500, message in dev only), REST as `protected` uppercase verbs on dev's `Route` (params from `this.match`, body as the one parameter), HTML replies via a server DOM shim, OpenAPI.
- The Reliability items above beyond the MVP.
- **Per-connection call ids.** Derive ids from the connection id issued by the connection's opening request, so a call is valid only on the connection that learned it. Also shared secrets between server and bundle.
- **Versioned client artifacts.** A deployed `api/` published as a client library needs version control across builds - beyond `remote.opaque: false`.
- **Build notice.** `expressive build` prints one line per non-root route module kept in the main bundle and why - e.g. it exports `Catch`; a `Catch` on its section's `index` covers it.
- **Repo placement.** dev incubates here as a trunk while it drives changes into mvc and dom; it is the likeliest package to move to `gabeklein/expressive-dev` at its first release, once its PRs stop touching core.

## Rejected

- **Scoped `X.use()` in a `Layout`**, with `undefined` rendering `children`. A route's State belongs in its `default` class - the one place a route declares what it provides.
- **Reset keys** (a `key()` dropping the prefix to share a subtree across visitors): no protection a module-level global lacks, at the cost of a second placement rule (contexts hanging under an ancestor) and shared subtrees cut off from identity. Shared State is a process global.

## Explored on the way

Ideas the context model replaced, kept so they are not re-proposed blind.

- **The TypeScript checker (or ts-morph) for twin members**: it resolves inherited members and modifiers directly, but adds `typescript` as a runtime dependency, type-checks the project per scan, and TypeScript 7.0 ships without a programmatic API (planned for 7.1). The scan follows `extends` through imports itself instead.
- **Lazy push driven by demand**: a plain synchronous read has no observer to announce it, so values must be eager; demand narrowing survives only as an explicit opt-in.

- **A fixed context tree** (session → tab → location contexts built in by dev): replaced by contexts keyed by the app's own keys. Dropped once as high upkeep while request objects had to live in the chain; `Current` removed that obstacle and cached contexts came back keyed.
- **A key register without cached contexts** (instances found by key, contexts rebuilt per request): every request would re-register each layer's instance and owned members into a fresh chain for `get()` to work.
- **Identity provider as dev's seam** (a `Session` class, or an `App.use()` returning a session key, as middleware): session is the app's concern.
- **`use()` returning an instance handed down to the next layer** (memo-like): superseded by `static key`.
- **Key as a tuple scoped by an instance**: keys stay plain and unique per class; `key()` salts them itself.
- **Scope as an object** (`{ session, tab, path }`): dev asserting a shape; the prefix is one opaque string with one purpose.
- **`key = false` for process globals**: globals are `static global` at module scope instead (Agreed shape).
- **TTL defaulting to Infinity or 0**: Infinity never frees; 0 rebuilds State between calls, so a twin looks broken until its class sets a TTL. Five minutes instead.
- **Keyed `X.use()` off the route chain** (`Account.use()` resolving through the class's own key): `key` is for seats; `use()` is positional.
- **`{fn}.{idx}` slots** for `use()` in free functions, hook-style: peer calls and branches shift slots silently. One instance per class per layer instead.
- **`static provider = github({...})`** on an account class: an OAuth client is its own process global.
- **An integration self-handling its callback** by inspecting every request: the route forwards to it.
- **`.expressive` endpoint prefix**: not needed for calls.
- **Lazy key pulling** (a twin starts empty; a first read suspends and fetches the key): public values must be readable without a separate mechanism.
- **`super.use()` to cascade**: mvc has no `use` on `State.prototype` (adapters check `typeof x.use == 'function'`), so it would need a default injected; automatic cascade instead.
- **`per(Type)`, a class-level `get` override, or a `Context` seam for request-scoped fields**: `Current` makes them unnecessary. A `State.on()` hook intercepting `get` for request classes may still be explored.
- **Requiring `default` classes to extend `Route`**: what is special is position (constructed per layer, keyed, `use()` per pass), not class; `key` applies to any State. Revisit if a feature needs Route's members.

## Open

- Status helpers - an exported error class's `status` field covers it for now. If wanted: naming (`NotFound` and `Redirect` collide with existing exports; leaning `Status.NotFound(...)`; `expressive-rpc` had `Forbidden`, `NotFound`, `Internal`, `BadInput`).
- Wire beyond the MVP: a per-page-load connection id is transport only (push routing and detach, never part of a key); patch frames; ids for nested twins (owner key + property path proposed); what counts as serializable (Date, Map, class instances).
- How params reach server code - the walk already matches the path against dev's route table (not the router, which stays client-side); `Route.get().match` or something plainer, decided when step 2 needs it.
- Optimistic writes - a follow-up decision. If ever: local writes rebased on incoming versions until acknowledged, rolled back on rejection.
- Demand as an mvc primitive - see Focus.
- Reliability defaults: timeouts, the per-call wait-or-fail option, the strict-route flag, replay buffer size.
- Hot reload retiring cached contexts.
- Client parity for the `mount()` cascade: the server needs it (owned helpers have no other attach signal), so the maintainer cascades on the client too, upstream.
- `api/**` is importable by the bundled client; whether its default (a REST `Route`) is twinned, and what a twin of a `Route` subclass carries, is assessed when the lane is built.
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
