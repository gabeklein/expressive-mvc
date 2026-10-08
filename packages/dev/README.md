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
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional service entry, run on the server: export default config({ port })
index.html            optional custom shell (#root and the entry script are injected if missing)
vite.config.ts        optional, merged under the host's config
```

Bare-named files under `app/` are support modules, not routes. `Page` may be a function or
`class Page extends Route` (from `@expressive/dev`), which owns its scope: read `this.match`,
override `children`, set `Catch` / `NotFound`.

The `default` export is read by kind. A function is the entry hook: it runs with the Route before
it renders, and a returned string redirects (`null` falls through to the 404). A class - State or
Component - renders around the route's content and is provided to everything below it; with a
`Layout`, it wraps the `Layout`.

Each route module becomes its own chunk, loaded when the route is first entered, unless it exports
`Loading`, `Catch` or a `default` - those are needed before the route renders - or is the root.

JSX compiles against `@expressive/dev`'s runtime, which is `@expressive/dom`'s. Set
`"jsxImportSource": "@expressive/dev"` in the app's tsconfig; the types carry dom's `State`
augmentation (`State.use()` and friends), so nothing else is needed.

## Server

`index.ts` runs on the server: in dev on Vite's module runner, in production inside
`dist/server/index.js`, which serves `dist/client` and falls back to `index.html` for client routes.

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
adds it and `@expressive/inspect/vite`. The generated server entry imports `serve` from
`@expressive/dev`, whose server build carries it.

## Example

`example/` is a routed app, a workspace package of its own. Its tsconfig maps
`@expressive/*` to the package sources, so the editor needs no build. Running it does: after
`bun run build` at the repo root, `bun run dev`, `bun run build` or `bun run start` inside `example/`.
