---
name: expressive-dev
description: Expressive app host (@expressive/dev) - expressive dev/build over Vite with @expressive/dom, a generated route tree, inspect and rpc. Use when working in an @expressive/dev app - layout, route modules, sidecars, server Model and seats, twins, commands.
---

# @expressive/dev

App host: `expressive dev` and `expressive build` over Vite, rendering with `@expressive/dom`, routing with `@expressive/router` from a generated tree, `@expressive/inspect` on the dev server, server calls through `@expressive/rpc`. Sidecar calls are stable; twins (server Models mirrored on the client) are experimental.

```bash
npm install @expressive/dev @expressive/mvc
```

tsconfig: `"jsxImportSource": "@expressive/dev"` - dom's runtime and its `Model` augmentation.

`@expressive/dev` exports `Route`, `Router` and `NotFound`, and re-exports `Link`, `NavLinks` and `Redirect` from `expressive-router` and `render`, `style`, `Css`, `Style`, `Portal`, `Fragment`, `createElement` and `JSX` from `expressive-dom`. `Model`, `Component` and instructions come from `@expressive/mvc`. The dev server's inspector is `expressive-inspect`. Per-symbol contracts are JSDoc on hover.

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
- `Catch` - error boundary for the route, given `{ error, retry }`.
- `NotFound` - replaces the default 404 below the folder.
- `default`, read by kind:
  - a function is the entry hook: runs with the Route before render, may be async; a returned string redirects, `null` falls through to the 404. Under a seat it runs after the first pull - type it `(route: Route & { remote: Seat })`.
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
- Module rules, errors (`HttpError` family from `@expressive/rpc`), ids and `opaque` are rpc's - `expressive-rpc`. Turn off hashed ids with `config({ remote: { opaque: false } })` in `index.ts`.
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
- `protected static key()` narrows the folder's context by what it returns - an identity from verified data (a `Cookies` field, a seat above via `get()`). `undefined` passes through; throwing refuses the call.
- `Cookies` (from `@expressive/dev/server`, as in rpc): a subclass declares cookies as fields; `AppCookies.get()` reads this request's and `AppCookies.set({ ... })` sends `Set-Cookie` with the reply - a twin's call or pull included. `Current` is the lower level: `.request`, `.url`, `.cookies`, read-only, and `setHeader(name, value)`.
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

- Values cross with rpc's codec - a `Date`, `Map`, `Set` or `BigInt` field arrives as one. Values change on the server only; assigning a twin field throws. Every call's reply carries what changed on the tab's twins; changes from elsewhere arrive on a stream and the twin pulls.
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
expressive build --prerender  also writes dist/client/<path>/index.html per static page
node dist/server/index.js  run the built service (port from index.ts, default 3000)
```

`--prerender` renders each page in Node with `renderToString` (`expressive-dom/SKILL.md#server-rendering`) and writes it with the style rules and head elements it rendered - a page's `<title>` goes ahead of the shell's. Suspended data is awaited, effects never run. A `[param]` or `[...]` page is skipped unless its module exports `paths()` - absolute paths to render, sync or async. Every folder with a `remote.ts` or `remote/` is skipped, ancestors included - those stay client-rendered, and the build never runs server code. Pages that redirect, render nothing or throw are skipped with a warning. The empty shell moves to `200.html` - point a static host's fallback there (Cloudflare Pages: `/* /200.html 200` in `_redirects`). The client hydrates the static page with `hydrate()` (`expressive-dom/SKILL.md#server-rendering`).

Nothing is written into the project - the shell, entry and route tree are virtual under `/.expressive/`. `@expressive/dev/vite` exports `expressive()` for a hand-written Vite config - add `inspect()` from `@expressive/inspect/vite` beside it for the relay. Server code runs on Vite's module runner in dev, with Node's `import.meta`.
