# @expressive/dev

`expressive dev` and `expressive build` for an Expressive app: Vite underneath, `@expressive/dom`
as the renderer, `@expressive/router` for the tree that `app/` generates, `@expressive/inspect`
on the dev server, and `app/api/` served by the same process.

## Project layout

```
app/                  file-based routes
  index.tsx           /            exports: Page, Layout, Loading, Catch, NotFound, default (entry hook)
  (about).tsx         /about       static leaf
  blog/index.tsx      /blog        folder = scope; its index is the "/blog" page
  blog/[slug].tsx     /blog/:slug  param leaf
  docs/[...].tsx      /docs/*      catch-all
  api/                server modules; never part of the client tree
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional service entry, run on the server: export default defineApp({ port })
index.html            optional custom shell (#root and the entry script are injected if missing)
vite.config.ts        optional, merged under the host's config
```

Bare-named files under `app/` are support modules, not routes. `Page` may be a function or
`class Page extends Route` (from `@expressive/dev`), which owns its scope: read `this.match`,
override `children`, set `Catch` / `NotFound`.

JSX compiles against `@expressive/dom`; set `"jsxImportSource": "@expressive/dom"` in the app's
tsconfig.

## Server lane

`index.ts` and everything under `app/api/` run on the server: in dev on Vite's module runner, so
an edit takes effect on the next request; in production inside `dist/server/index.js`.

Each `app/api/**/*.ts` module's function exports are endpoints. The module's path under
`app/api/` is the prefix (`index.ts` is the root), the export name the last segment:

```
app/api/index.ts        export const ping = () => "pong"          GET  /api/ping
app/api/greetings.ts    export async function hello(name) {...}   POST /api/greetings/hello   body: ["Gabe"]
app/api/blog/posts.ts   export const list = () => [...]           GET  /api/blog/posts/list
```

`POST` passes the JSON array body as arguments, `GET` passes none. The result is JSON; a thrown
error is `{ "error": message }` with 500, an unknown module or export 404, a non-array body 400.

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
adds it and `@expressive/inspect/vite`. `@expressive/dev/server` is the production runtime the
generated server entry imports.

## Example

`example/` is a routed app with an api module. From this package, after `bun run build` at the
repo root: `node dist/cli.js dev` inside `example/`.
