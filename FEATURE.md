# @expressive/dev

Next-like host for Expressive: Vite, `@expressive/dom` rendering, file-based routes, a server lane. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/dev-server` is the trunk. Each feature lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Upstream fixes (mvc, dom, router) land on `main` as their own PRs, never only here.
- `backup/dev-server-full` holds the pre-trunk prototype - source for the queued features below. Delete once the queue has drained it.

## Agreed shape

- **One surface.** The root export has `browser` and `default` (server) builds with identical names. `serve` is real on the server, throws in the browser.
- **Turnkey.** dom, router, inspect are dependencies; `@expressive/mvc` is the only peer.
- **JSX.** `jsxImportSource: "@expressive/dev"` - dev's runtime re-exports dom's.
- **Router.** dev exports its own `Router` (extends `BrowserRouter`) and `Route`, plus `Link`, `NavLinks`, `Redirect`. No `BrowserRouter` export.
- **Config.** `index.ts` default-exports `config({...})`, read on the server.
- **dom on the server.** Needed for JSX rendered to HTML (responses, emails), not SSR.
- **Monkey-patch first.** Where mvc or an adapter lacks a seam, dev patches it in one file, replaced when upstream catches up. Stress-tests the concept before committing upstream.
- **Server `get`/`use` are dev's, permanently.** Request-scoped resolution is a host concern - no core or dom change. The server build replaces `State.get`/`State.use` (installed after dom evaluates, asserted at boot) and overrides only the no-argument `Context.get()`; the client keeps dom's behavior.
- **Process globals stay core's.** `static global` with a module-scope `X.new()` registers in the real root, untouched by requests. Opt-in sugar for this (#473) is the maintainer's call and blocks nothing here.

## Landed

1. Basics - `app/` route tree (`Page`, `Layout`, `Loading`, `Catch`, `NotFound`), single-file `app.tsx` mode, virtual shell/entry/router module, dev server with inspect, client + node service build, static `serve` with `index.html` fallback, example workspace.

## Queue

In order. Each item is one PR into the trunk.

2. **Route chunks.** Modules exporting only `Page`/`Layout`/`NotFound` (not root) load on first entry.
3. **Route defaults (client).** A page module's `default` by kind: function = entry hook (runs with the Route on entry; a returned string redirects); `State` class = the scope's State, one instance per entry, provided to layout and pages; `Component` class = `Layout`. Server-side defaults are middleware (below).
4. **RPC lane.** `app/api/**` function exports at `/api/<module>/<fn>`, JSON array body, JSON reply. In the browser a server module is replaced by a stub that posts its arguments. `app/api/**` is importable anywhere.
5. **Sidecars.** `api.ts` beside a page: exports at `POST <scope path>/<fn>`. Its `default` is the scope's middleware (see Middleware). Importable only from its own folder and below (build error otherwise).
6. **Request scope.** One `Call` per request, held in `AsyncLocalStorage`. `Context.get()` (no argument) returns the call's context, else `Context.root`. `T.get()` resolves from the current chain; `T.use()` is get-or-create in the current context. Both throw outside a `Call`; results are snapshots, not reactive.
7. **Sessions + auth.** The walk knows nothing of sessions: a session is what a provider writes into `call.context`. A default cookie provider ships (HttpOnly, `SameSite=Lax`, `Secure` in production; created lazily; id rotates on login); exporting a provider replaces it, bearer included. CSRF (JSON content-type on POST) only for cookie-identified requests. Without a session, same-URL requests share state - fine for localhost and curl. In memory: live State, not serialized - persistence is the app's own State loading its data.
8. **REST routes.** An `app/api/**` module's `default` is `class X extends Route` (dev's) with `protected` verbs `GET`/`POST`/`PUT`/`PATCH`/`DELETE`, declared optional on dev's `Route` so subclasses autocomplete. Uppercase because Route resolves its router with `this.get(Router)`. Params and query come from `this.match`/`this.query` (dev provides a request `Router`); only the body is a parameter (POST/PUT/PATCH), and its type feeds the spec. The class's `use()` is middleware for its path and below; verbs run on the leaf only. Named exports stay RPC under the same middleware. The generator rejects verbs on page modules and sidecars. Reply pipeline shared by return and throw: string → `text/plain`, `undefined` → 204, other values → JSON, status helpers set status, data primitives (`file`, `stream`, ...) added as needed. Uncaught errors → 500, message only in dev.
9. **HTML replies.** JSX → `text/html` via a server DOM shim; styles used by the render collected into one `<style>`. Email inlining later.
10. **Twins.** What a client does with a server module's `default`: pubsub to its user-defined reactive values. The browser stub's default is a twin - a client State mirroring the server instance in its matching context (session or route), public methods as RPC. A subscription keeps the server instance alive; its TTL resumes once the last one leaves. Needs a push transport (SSE or socket).
11. Import-rewrite extras (named bodies, OpenAPI from handler types).

## Request model

```
Context.root            process globals (static global)
└ session ctx           a provider's key; everything use()d lives at or below
  └ route ctxs          one per segment, found or created on each visit; middleware
    └ request ctx       Call, ttl-0 instances
```

- **`Call`.** One instance per request - the request's own State. `call.context` starts as the session provider's choice and is writable. At the leaf, dev pushes a request context holding the `Call`, so `Call.get()` works anywhere below. Name chosen over Request/Response (Fetch globals), Exchange, Reply, Visit. `Fetch` still under consideration (Service Worker `FetchEvent` precedent) - against it, its natural instance name shadows global `fetch()`.
- **Contexts are reachable only through the call**, never by key.
- **TTL.** Optional `static ttl` (seconds) seeds a managed instance `ttl` (a deadline; reads as remaining life). A `use()` retrieval resets it. `ttl = 0`, the default, lives until the end of the current request; `set(null)` destroys now. Best effort - never before the deadline, possibly after; one sweeper per process; nothing is destroyed while a request using it is in flight.
- **Cleanup.** A cached context counts its live States and in-flight calls; at zero it pops and leaves its parent, folding up from the leaves. Ending a session destroys its subtree. `Context.pop()` does not destroy instances, so dev tracks and destroys what it created.

## Middleware

A sidecar's `default` export is its route's middleware. On each visit dev walks segments root→leaf and runs each one's middleware in that segment's context, then the handler.

- `export default class X extends State {}` is `export default () => X.use()`.
- `X.use()` gets or creates in the segment's context: `new()` once on creation; the instance's `use(...args)` method - the hook client `State.use()` calls per render - on every visit, reused or not. A retrieval resets the TTL.
- With the default `ttl = 0` the instance is per request; `static ttl` keeps it across visits, its `use()` running on each.
- **Interception.** Return nothing - continue. Async - awaited before the next segment. Throw a reply (a status helper) - the walk stops, the handler never runs, and the reply takes the same pipeline as a handler's return. Write `call.context` - everything after hangs off the new context.
- Response changes after the handler (headers, cookies) go through `Call`, not by wrapping.

## Open

- Status helper naming - `NotFound` and `Redirect` collide with existing exports. Leaning `Status.NotFound(...)`.
- Session provider details: cookie name, id minting, how a provider is exported; lifetime of the session context itself.
- Hot reload retiring route scopes and their instances.
- Whether a middleware's `use()` may return a cleanup (run leaf→root after the reply).
- Twin boundary as a runtime rule - TS `protected` does not exist at runtime, so what replicates and what a client may call cannot rest on it. `_`-prefixed (unmanaged) and `#private` members stay server-only; whether public methods are callable by default or by opt-in is undecided (default-deny is the safer side).
- What a twin of a `Route` subclass carries of Route's own members (`match`, `query`, render surface).

## Upstream (bullpen)

- mvc #473: `State.new(true)` as explicit opt-in to process globals - not a prerequisite.
- dom: optional `rendering?()` on `HostRuntime` - approved in shape, unused until dom renders in a server process.
- dom: string renderer + style collector. Replaces the item-9 shim.
- router: `@jsxImportSource @expressive/mvc` pragma on `link`/`nav`/`route` (on the trunk as a stopgap commit).
- dom: #454 parent-first ordering (0.21 kB). React: keep uncommitted State across retries.

## Release gates

- 100% coverage like every package - dev's `coverage` script runs vitest without `--coverage` until then.
- `skills/` docs, changeset, `private: false`.
- Router stopgap replaced by its upstream PR.
