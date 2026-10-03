# @expressive/dev

`expressive dev` and `expressive build` for an Expressive app: Vite underneath, `@expressive/dom`
as the renderer, `@expressive/router` for the tree that `app/` generates, `@expressive/inspect`
on the dev server, and `app/api/` served by the same process.

## Project layout

```
app/                  file-based routes
  index.tsx           /            exports: Page, Layout, Loading, Catch, NotFound, default (hook or State)
  (about).tsx         /about       static leaf
  blog/index.tsx      /blog        folder = scope; its index is the "/blog" page
  blog/[slug].tsx     /blog/:slug  param leaf
  docs/[...].tsx      /docs/*      catch-all
  api/                server modules; never part of the client tree
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional service entry, run on the server: export default config({ port })
index.html            optional custom shell (#root and the entry script are injected if missing)
vite.config.ts        optional, merged under the host's config
```

Bare-named files under `app/` are support modules, not routes. `Page` may be a function or
`class Page extends Route` (from `@expressive/dev`), which owns its scope: read `this.match`,
override `children`, set `Catch` / `NotFound`.

The `default` export is read by kind. A function is the entry hook: it runs on scope entry with
the Route, and a returned string redirects. A `State` class is the scope's State: one instance
is created when the scope is entered, provided to the layout and every page under it, and
destroyed on exit. A `Component` class stands in for `Layout`.

Each route module becomes its own chunk, loaded when the route is first entered. A module that
exports `Loading`, `Catch` or a `default` is imported statically instead, as is the root
`index.tsx`, since those are needed before the route renders.

JSX compiles against `@expressive/dev`'s runtime, which is `@expressive/dom`'s. Set
`"jsxImportSource": "@expressive/dev"` in the app's tsconfig; the types carry dom's `State`
augmentation (`State.use()` and friends), so nothing else is needed.

## Server lane

`index.ts`, everything under `app/api/`, and any `api.ts` beside a page run on the server: in dev
on Vite's module runner, so an edit takes effect on the next request; in production inside
`dist/server/index.js`. The browser never receives their code.

**`app/api/**`** is the app's API. Each module's function exports are endpoints at its path:

```
app/api/index.ts        export const ping = () => "pong"          GET|POST /api/ping
app/api/greetings.ts    export async function hello(name) {...}   POST /api/greetings/hello   body: ["Gabe"]
```

**`api.ts` beside a page** is that scope's sidecar. Its exports are endpoints at the scope's path,
POST only, since GET there is the page:

```
app/api.ts              export const ping = () => "pong"          POST /ping
app/blog/api.ts         export async function list() {...}        POST /blog/list
app/blog/[slug]/api.ts  export async function like() {...}        POST /blog/hello/like
```

A sidecar's `default` function is a hook: before any function runs, the hooks of its scope and
every scope above it run from the root down, and a throw stops the call.

**Calling from the client.** Import the function. In the browser the module is replaced by a stub
that posts its arguments, so `import { list } from "./api"` then `await list()` is the whole
API; types are the server module's own. A sidecar may be imported from its own folder and those
below it; anything else is a build error, since only there does the current location fill the
scope's params. `app/api/**` may be imported from anywhere.

`POST` takes a JSON array of arguments and answers JSON. A thrown error is `{ "error": message }`
with 500, an unknown function 404, a malformed body 400.

## Commands

```
expressive dev             Vite dev server with HMR; /api on the module runner; /__inspect relay
expressive build           dist/client (static app) and dist/server/index.js (node service)
expressive build --pretty  unminified client, stable filenames
node dist/server/index.js  run the built service (port from index.ts, default 3000)
```

Nothing is written into the project. The shell, the client entry and the generated router module
are virtual, addressed under `/.expressive/`. The router module regenerates when files appear or
vanish under `app/`.

`@expressive/dev/vite` exports the `expressive()` plugin for a hand-written Vite config; the CLI
adds it and `@expressive/inspect/vite`. The generated server entry imports `serve` from
`@expressive/dev`, whose server build carries it.

## Example

`example/` is a routed app with an api module, a workspace package of its own. Its tsconfig maps
`@expressive/*` to the package sources, so the editor needs no build. Running it does: after
`bun run build` at the repo root, `bun run dev`, `bun run build` or `bun run start` inside `example/`.
