# @expressive/dev

App host: `expressive dev` and `expressive build` over Vite, rendering with `@expressive/dom`, routing with `@expressive/router` from a generated tree, `@expressive/inspect` on the dev server, server calls through `@expressive/rpc`. Sidecar calls are stable; twins (server Models mirrored on the client) are experimental.

```bash
npm install @expressive/dev @expressive/mvc
```

tsconfig: `"jsxImportSource": "@expressive/dev"` - dom's runtime and its `Model` augmentation.

## Layout

```
app/                  file-based routes
  index.tsx           /            exports: Page, Layout, Loading, Catch, NotFound, default
  (about).tsx         /about       static leaf
  blog/index.tsx      /blog        folder = scope; its index is the page
  blog/[slug].tsx     /blog/:slug  param leaf
  docs/[...].tsx      /docs/*      catch-all
  blog/remote.ts      sidecar      server module for /blog and below
  blog/remote/        sidecar      or a folder of them, any depth
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional server entry: export default config({ port })
index.html            optional shell (#root and the entry script injected if missing)
vite.config.ts        optional, merged under the host's
```

Bare-named files under `app/` are support modules. Siblings match static before `:param` before `*`.

## Route modules

- `Page` - a function (params via `Route.get().match`) or `class Page extends Route` (from `@expressive/dev`) with `this.match`, fields and `render()`.
- `Layout` - wraps the folder's pages; `children` is the content slot.
- `Loading` - placeholder for the slot of the `Layout` beside it, for any page below still loading code, an entry hook or data, until a nested `Layout`. A page's own `Loading` covers it first. Shown on cold arrival only - in-app navigation holds the current page (`Router.get().navigating`).
- `Catch` - error boundary for the route.
- `NotFound` - replaces the default 404 below the folder.
- `default`, read by kind:
  - a function is the entry hook: runs with the Route before render; a returned string redirects, `null` falls through to the 404.
  - a Model or Component class renders around the content (around `Layout` if present) and is provided below.

Each module is its own chunk, loaded on first entry, unless it is the root or exports `Loading` or `Catch`.

## Sidecars

A `remote.ts` beside a route runs on the server. Exports are `async` functions; the route's code imports them and gets stubs.

```ts
// app/tally/remote.ts
let total = 0;
export async function add(by: number) { return (total += by); }
```

```tsx
// app/tally/index.tsx
import { add } from "./remote";
```

- A call POSTs to the folder's path, params filled from the current location (`/blog/a` for `app/blog/[slug]/remote.ts`).
- Only the folder and those below it may import its sidecar - the build throws otherwise.
- A `remote/` folder holds several; every module in it belongs to the parent folder and is never a route.
- Module rules, errors (`HttpError` family from `@expressive/rpc`), ids and `opaque` are rpc's - [rpc.md](rpc.md). Turn off hashed ids with `config({ remote: { opaque: false } })` in `index.ts`.
- Only stubs the client loaded (dev) or the build generated are callable; a helper in `remote/` is never an endpoint.

## Server Model

Inside a call, `X.get()` finds the nearest server Model at the call's location or above; it throws outside a call. A folder's remote entry (`remote.ts` or `remote/index.ts`) may default-export a Model - its seat:

```ts
export default class Tally extends Model {
  static ttl = 3600;   // seconds alive after its last call; 300 by default
  total = 0;
}

export async function add(by: number) {
  return (Tally.get().total += by);
}
```

- One seat per location: `/blog/a` and `/blog/b` hold separate ones; a seat lower down shadows one above.
- `protected static key()` narrows the folder's context by what it returns - an identity from verified data (`Current.get().cookies`, a seat above via `get()`). `undefined` passes through; throwing refuses the call.
- `Current` (from `@expressive/dev/server`) is the request: `.request`, `.url`, `.cookies`. Read-only.
- Process-wide state: a module-level `X.new(Context.root)`, found by `get()` from any call.

## Twins (experimental)

A seat's public `async` methods and public values cross to the client: the folder's Route builds a twin and provides it below. Read it in a `Route` with `declare remote: Tally`, elsewhere with `get(Tally)`.

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

- Values change on the server only; assigning a twin field throws. Every call's reply carries what changed on the tab's twins; changes from elsewhere arrive on a stream and the twin pulls.
- Entering a seated folder waits for the twin's first pull (`Loading` on a cold load). A refused pull reaches the nearest `Catch`; an error with a 3xx `status` and `location` redirects.
- A field holding a Model the seat owns (`line = new Line()`, or `line?: Line`) is a child twin.
- Other exported Model classes are pooled: each `new Cart()` a Component owns, or `Cart.new()`, gets its own server instance.
- A public `get()` field fails the build - declare it `protected`.
- Reload the page when a call changes what a `key()` returns (login, logout): twins keep the context they were built in.

Known gaps: a param change remounts the page; the root seat cannot gate some calls and not others; a class used as a child is also pooled; reads suspend until the first snapshot.

## Commands

```
expressive dev             Vite dev server with HMR; /__inspect relay
expressive build           dist/client and dist/server/index.js
expressive build --pretty  unminified client, stable filenames
node dist/server/index.js  run the built service (port from index.ts, default 3000)
```

Nothing is written into the project - the shell, entry and route tree are virtual under `/.expressive/`. `@expressive/dev/vite` exports `expressive()` for a hand-written Vite config. Server code runs on Vite's module runner in dev, with Node's `import.meta`.
