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

## Landed

1. Basics - `app/` route tree (`Page`, `Layout`, `Loading`, `Catch`, `NotFound`), single-file `app.tsx` mode, virtual shell/entry/router module, dev server with inspect, client + node service build, static `serve` with `index.html` fallback, example workspace.

## Queue

In order. Each item is one PR into the trunk.

2. **Route chunks.** Modules exporting only `Page`/`Layout`/`NotFound` (not root) load on first entry.
3. **Route defaults.** A module's `default` by kind: function = entry hook (runs with the Route on entry; a returned string redirects); `State` class = the scope's State, one instance per entry, provided to layout and pages; `Component` class = `Layout`.
4. **RPC lane.** `app/api/**` function exports at `/api/<module>/<fn>`, JSON array body, JSON reply. In the browser a server module is replaced by a stub that posts its arguments. `app/api/**` is importable anywhere.
5. **Sidecars.** `api.ts` beside a page: exports at `POST <scope path>/<fn>`. Its `default` function is a hook; hooks run root→leaf before the function. Importable only from its own folder and below (build error otherwise).
6. **Ambient lookup (patch).** `Context.get()` with no argument is the ambient source; dev overrides it per request via `AsyncLocalStorage`. `State.get()` outside a render resolves from it, defaulting to root. A State created while the ambient context is not root records it as its own, so `get(T)` fields resolve against the request that made it. Static lookups resolve at call time - don't keep their results on longer-lived objects.
7. **Sessions + auth.** Identity sources: HttpOnly cookie by default (`SameSite=Lax`, `Secure` in production), bearer opt-in, user-configurable. Created lazily; sliding TTL; in memory (live State, not serialized - persistence is the app's Session State loading its own data). Id rotates on login, destroyed on logout. CSRF (JSON content-type on POST) only for cookie-identified requests. Survives server hot reload. Context chain per request: root → session → route scope layers (per request, popped) → request → render. Facade name TBD - not `Request` (shadows the global).
8. **REST routes.** `export default rest({ GET, POST, ... })` in `app/api/**` only; named exports in the same module stay RPC. Handlers `(input, params)`: input is the parsed query for GET/DELETE/HEAD, the parsed body otherwise. Reply pipeline shared by return and throw: string → `text/plain`, `undefined` → 204, other values → JSON, status helpers set status, data primitives (`file`, `stream`, ...) added as needed. Uncaught errors → 500, message only in dev.
9. **HTML replies.** JSX → `text/html` via a server DOM shim; styles used by the render collected into one `<style>`. Email inlining later.
10. Import-rewrite extras (named bodies, OpenAPI from handler types), twins (route layers that live as long as the client is inside the route), sockets.

## Open

- Status helper naming - `NotFound` and `Redirect` collide with existing exports. Leaning `Status.NotFound(...)`.
- A class form for REST (`extends Rest`, or a projection of `Route`) - deferred until the full union of route roles is known. Verbs would be uppercase: `get`/`set` are State's own.
- Persistent route layers before twins - opt-in only, if ever.

## Upstream (bullpen)

- mvc: static `State.get` in core resolving through `Context.get()`; creation anchoring. Replaces the item-6 patch.
- dom: string renderer + style collector. Replaces the item-9 shim.
- router: `@jsxImportSource @expressive/mvc` pragma on `link`/`nav`/`route` (on the trunk as a stopgap commit).
- dom: #454 parent-first ordering (0.21 kB). React: keep uncommitted State across retries.

## Release gates

- 100% coverage like every package - dev's `coverage` script runs vitest without `--coverage` until then.
- `skills/` docs, changeset, `private: false`.
- Router stopgap replaced by its upstream PR.
