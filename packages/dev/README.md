# @expressive/dev

`expressive dev` and `expressive build` for an Expressive app: Vite underneath, `@expressive/dom`
as the renderer, `@expressive/router` for the tree that `app/` generates, and `@expressive/inspect`
on the dev server.

## Project layout

```
app/                  file-based routes
  index.tsx           /            exports: Page, Layout, Loading, Catch, NotFound, default
  (about).tsx         /about       static leaf
  blog/index.tsx      /blog        folder = scope; its index is the "/blog" page
  blog/[slug].tsx     /blog/:slug  param leaf
  docs/[...].tsx      /docs/*      catch-all
  blog/api.ts         sidecar      server module for /blog and below
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional service entry, run on the server: export default config({ port })
index.html            optional custom shell (#root and the entry script are injected if missing)
vite.config.ts        optional, merged under the host's config
```

Bare-named files under `app/` are support modules, not routes. `Page` may be a function, reading
its params through `Route.get().match`, or `class Page extends Route` (from `@expressive/dev`) with
`this.match`, its own fields and `render()`. That is the one intended use of `Route` - folders
express nesting. dev's `Route` owns no suspense boundary unless given a `fallback` or `Catch`, so a
page's waits show its slot's `Loading`.

The `default` export is read by kind. A function is the entry hook: it runs with the Route before
it renders, and a returned string redirects (`null` falls through to the 404). A class - State or
Component - renders around the route's content and is provided to everything below it; with a
`Layout`, it wraps the `Layout`.

`Loading` is the placeholder for the content slot of the `Layout` beside it: any page rendered
there that cannot show anything yet - its code, its entry hook or its data still pending - shows
it in place, inside the layout. It reaches pages at any depth until a nested `Layout`, which starts
its own slot. A page's own `Loading` covers that page first. Navigation inside the app never shows
it - the current page holds until the next is ready (`Router.get().navigating` meanwhile); it is
for arriving cold, by link or refresh. A Component or a State with its own `fallback` keeps its
waits to itself.

Each route module becomes its own chunk, loaded when the route is first entered - `default`
included - unless it is the root or exports `Loading` or `Catch`, which must be on hand before
anything below them can wait or fail.

JSX compiles against `@expressive/dev`'s runtime, which is `@expressive/dom`'s. Set
`"jsxImportSource": "@expressive/dev"` in the app's tsconfig; the types carry dom's `State`
augmentation (`State.use()` and friends), so nothing else is needed.

## Server

`index.ts` runs on the server - in dev on Vite's module runner, in production inside
`dist/server/index.js`, which serves `dist/client` and falls back to `index.html` for client routes.
It imports `config` from `@expressive/dev/server`.

### Sidecars

An `api.ts` in a route folder runs on the server. Each export is an `async` function; the browser
imports a stub that calls it.

```ts
// app/tally/api.ts
let total = 0;
export async function add(by: number) { return (total += by); }
```

```tsx
// app/tally/index.tsx
import { add } from "./api";
```

A call is `POST` to the folder's path with its params filled from the current location (`/blog/a`
for `app/blog/[slug]/api.ts`), an `x-expressive-call` header naming the function, and the
arguments as a JSON array. The reply is the value as JSON, or 204 for `undefined`. Only the folder
and those below it may import its sidecar.

A sidecar may also export `Error` subclasses. Thrown on the server, one rejects the call on the
client as the same class - `instanceof` works - with its message and own fields; a numeric
`status` field in 400-599 sets the reply's status (409 below, else 500). Any other thrown error
rejects with its message in dev and a generic one in production.

```ts
export class Overflow extends Error {
  status = 409;
  constructor(public limit: number) { super(`The tally stops at ${limit}.`); }
}
```

The build refuses any other export - a sync function, a value, a class without `extends`, a
re-export or a default - since the client could not use it. A class whose base is not an `Error`
fails its first call in dev and the built service at startup.

### Server State

Inside a call, `X.use()` gets or creates an instance of `X` and `X.get()` finds one in context.
Both throw outside a call. An instance is found again by its key - by default the location it was
used at, so `/blog/a` and `/blog/b` hold separate ones and every visitor to a location shares one.
`static key(prefix)` changes that: return `prefix` plus more to narrow, or something without it to
share across locations. An instance lives while a call uses it, then `static ttl` seconds (0 by
default); `set(null)` ends it at once.

```ts
class Tally extends State {
  static ttl = 3600;
  total = 0;
}

export async function add(by: number) {
  return (Tally.use().total += by);
}
```

`Current` (from `@expressive/dev/server`) is the request in progress, readable from any server
State or function in a call: `Current.get().url`, `.cookies`, `.request`. Its accessors read the
call live, so a reused instance may hold it in a field (`current = get(Current)`) but should not
copy its values into its own.

## Commands

```
expressive dev             Vite dev server with HMR; /__inspect relay
expressive build           dist/client (static app) and dist/server/index.js (node service)
expressive build --pretty  unminified client, stable filenames
node dist/server/index.js  run the built service (port from index.ts, default 3000)
```

Nothing is written into the project. The shell, the client entry and the generated router module
are virtual, addressed under `/.expressive/`. The router module regenerates when files appear or
vanish under `app/`.

`@expressive/dev/vite` exports the `expressive()` plugin for a hand-written Vite config; the CLI
adds it and `@expressive/inspect/vite`. Server-only API - `config`, `serve`, `Current` - is
`@expressive/dev/server`; the generated server entry imports `serve` from there.

## Example

`example/` is a routed app, typechecked with the package. Running it needs a build: after
`bun run build` at the repo root, `bun run example`, `bun run example:build` or
`bun run example:start` here.

`bun run example:e2e` here runs its Playwright specs (`example/e2e/`) against both the dev server
and the built service, after `bun run build` at the root. Set `CHROME` to use a local Chromium
binary.
