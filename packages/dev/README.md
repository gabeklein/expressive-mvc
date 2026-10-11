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
  blog/remote.ts      sidecar      server module for /blog and below
  blog/remote/        sidecar      or a folder of them, any depth, index optional
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
It imports `config` from `@expressive/dev/server`: `port`, and `remote.opaque` (below).

### Sidecars

A `remote.ts` in a route folder runs on the server. Each export is an `async` function; the browser
imports a stub that calls it. For more than one module, use a `remote/` folder instead: every module
in it, at any depth, belongs to the parent folder - `app/blog/remote/feed/latest.ts` runs for `/blog`,
and `remote/` is never a route.

```ts
// app/tally/remote.ts
let total = 0;
export async function add(by: number) { return (total += by); }
```

```tsx
// app/tally/index.tsx
import { add } from "./remote";
```

A call is `POST` to the folder's path with its params filled from the current location (`/blog/a`
for `app/blog/[slug]/remote.ts`), an `x-expressive-call` header naming the function (`add`, or
`feed/latest:add` inside `remote/`), the tab's `x-expressive-connection` id, and the arguments as a
JSON array. The reply is `{ value, frame }` - the frame carries what the call changed on the tab's
twins (below). Only the folder and those below it may import its sidecar.

Only what the client imports is callable: the server accepts calls to the stubs the browser loaded in
dev, and to those the client build generated in production - a helper module in `remote/` is never
an endpoint. Remote calls are not a public API. The production build names each call by a hash
unique to the build, so a stale tab fails rather than calling changed code; `remote: { opaque: false }`
in `index.ts` keeps readable names, for clients that must outlive a deploy.

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

The build refuses any other export - a sync function, a value, a class without `extends` or a
re-export - since the client could not use it; a default is the folder's twin (below). A class whose base is not an `Error`
fails its first call in dev and the built service at startup.

### Server State

Inside a call, `X.use()` gets or creates the instance of `X` at the call's location - the
sidecar's folder - and `X.get()` finds the nearest one at that location or above. Both throw outside
a call. `/blog/a` and `/blog/b` hold separate instances, every visitor to a location shares one, and
a `use()` further down shadows one above. `get()` finds nothing until a `use()` has made it. An
instance lives while a call uses it, then `static ttl` seconds (300 by default); `set(null)` ends
it at once.

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

### Twins

A folder's remote entry (`remote.ts` or `remote/index.ts`) may default-export a State class. Every
call walking through the folder seats one instance in its context - `get()` finds it there and below
- and the route tree provides its twin around the folder's routes on the client. The twin's methods
are the class's public `async` methods, each a call to that instance.

```ts
// app/counter/remote.ts
export default class Counter extends State {
  count = 0;
  async increment() { return ++this.count; }
}
```

```tsx
// app/counter/index.tsx
import Remote from "./remote";

export class Page extends Component {
  remote = get(Remote);
  render() {
    const { remote } = this;
    return <button onClick={() => remote.increment()}>{remote.count}</button>;
  }
}
```

`static key()` narrows the folder's context, and everything below it, by what it returns - an
identity from `Current.get().cookies`, or a value from a seat above through `get()`. Undefined passes
the location through; throwing denies the call. Build the key from verified data only - a raw cookie
lets the client pick its context - and declare it `protected`. The seat lives for `static ttl` after
its last call; when it ends, its context and everything below go with it.

Methods a seat inherits cross too: the build follows its bases by import - source, or a package's
`.d.ts` - up to `@expressive`'s classes, and the nearest declaration's `private`/`protected` wins. A
base it cannot follow, such as `extends mixin(State)`, fails the build.

A twin holds the seat's public values too. It attaches on construction and suspends until the
snapshot arrives. Every call's reply - a twin's method or a plain function - carries everything that
changed on any twin the tab holds since that twin last heard, so an awaited call never reads stale,
even where it changed a parent folder's twin through `get()`. Values change on the server only -
assigning a twin field throws. Twins made by client `use()`, and refresh of changes the server makes
on its own, come later.

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
