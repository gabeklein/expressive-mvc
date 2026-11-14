# @expressive/rpc

## 0.3.0

### Minor Changes

- [#710](https://github.com/gabeklein/expressive/pull/710) [`f722198`](https://github.com/gabeklein/expressive/commit/f722198d8ae0b9fb99ad0c82e8d48c01f604085e) A folder's gate may be a function: an index's default run before each call in its folder and below. The Models it activates, and those they activate while settling, belong to that call. They are in reach of `.get()`, waited on until ready, and destroyed when it ends, and one whose `new()` fails refuses the call with its error, unreported.

- [#661](https://github.com/gabeklein/expressive/pull/661) [`35f2d80`](https://github.com/gabeklein/expressive/commit/35f2d8084dc95ca542bc3c1eedef7a4caddb74d7) A folder's gate runs per request by default: its instance ends after the last call holding it, so a logout or revoked session takes effect on the next call. `static ttl` still caches one per key, and `set(null)` on it ends it early. dev keeps its seats for 300 seconds by default, as before.

- [#712](https://github.com/gabeklein/expressive/pull/712) [`8503354`](https://github.com/gabeklein/expressive/commit/8503354dff1f64f65ec1f1d30e40c72c8fcc888b) A server module may export groups - objects of calls and Error classes imported from elsewhere in `dir` - and re-export them. Each call keeps its defining module's path, id and gates. The new `test` option narrows which modules under `dir` are server modules: the rest stay plain, stubbed only for the calls a server module groups or re-exports, and a folder's gate is the default of its index only when `test` selects it.

### Patch Changes

- Updated dependencies [[`b7be047`](https://github.com/gabeklein/expressive/commit/b7be047c229a1bcaeb7906b660261e2b64edc584)]:
  - @expressive/mvc@0.94.5

## 0.2.0

### Minor Changes

- [#662](https://github.com/gabeklein/expressive/pull/662) [`40a1ef0`](https://github.com/gabeklein/expressive/commit/40a1ef0ba97257ce936ff318b6768f600c2910e7) The server entry's `fetch` runs in the request's scope: `Current` and `Cookies` work in its routes as in a call, and the headers and cookies they set join the route's response. `scoped(app)` from `@expressive/rpc/http` does the same for a host wrapping an entry itself.

- [#663](https://github.com/gabeklein/expressive/pull/663) [`3042161`](https://github.com/gabeklein/expressive/commit/3042161db2e9c77999826f84cb9fc60a9736a3b2) The server bundle honors the app's own `environments.rpc.resolve` externals: set `noExternal` (or `external`) and dependencies stay installed instead of bundled - for a Node server with `pg` or `firebase-admin`. Without either, it still bundles everything for a Worker. The calls module is bundled either way.

### Patch Changes

- Updated dependencies [[`ea0f0c6`](https://github.com/gabeklein/expressive/commit/ea0f0c63ea5d1a689084a6bc170f47087b0c05f0)]:
  - @expressive/mvc@0.94.3

## 0.1.1

### Patch Changes

- [#651](https://github.com/gabeklein/expressive/pull/651) [`173a60c`](https://github.com/gabeklein/expressive/commit/173a60ce8245f509da4a1735c4788472dea5462e) Ship each package's agent skill in the package, at `skills/expressive-<pkg>/SKILL.md`, so the docs an agent reads match the installed version. `npx skills experimental_sync` links them into `.claude/skills/` and `.agents/skills/`; `expressive-mvc` holds the core, and each package's skill links its siblings as installed side by side. On expressive.dev the skills move to `/llm/expressive-<pkg>/`, with the old `/llm/` paths redirecting.

- [#672](https://github.com/gabeklein/expressive/pull/672) [`f0e6e70`](https://github.com/gabeklein/expressive/commit/f0e6e7033237aef547d4088e69df1ced13e6880b) Skill corrections: inspect's `caught` kinds and `site`, rpc's `Redirect` status, router's guard rejection and `Redirect` timing, dom's status, dev's hand-written Vite config needing `inspect()`, and steps linking the mvc skill.

- [#668](https://github.com/gabeklein/expressive/pull/668) [`f9eabf1`](https://github.com/gabeklein/expressive/commit/f9eabf14a39c91e069072dacbaff02657289685f) Fix the skill's frontmatter, which was invalid YAML, so skill installers skipped it.
- Updated dependencies [[`5fec34c`](https://github.com/gabeklein/expressive/commit/5fec34c05a268718f4dec2bdafd13de22264821c), [`11e3c48`](https://github.com/gabeklein/expressive/commit/11e3c48fbb1f27e80128a5209c5ad2ff099ddd64), [`173a60c`](https://github.com/gabeklein/expressive/commit/173a60ce8245f509da4a1735c4788472dea5462e)]:
  - @expressive/mvc@0.94.2

## 0.1.0

### Minor Changes

- [#644](https://github.com/gabeklein/expressive-mvc/pull/644) [`bdc4c77`](https://github.com/gabeklein/expressive-mvc/commit/bdc4c77db1ed0b52c26b0cba1ce03c306416d3d4) First release. Typed server calls for any Vite client build: `rpc()` from `@expressive/rpc/vite` turns a folder of `async` functions (`api/` by default) into client stubs and a server bundle that runs as a Cloudflare Worker or under Node through `toNode`. Ships the `HttpError` family rebuilt on the client, folder gates through an index's default Model and its `static key()`, `Cookies` - a Model of the request's cookies whose changed fields go out as `Set-Cookie` - and `Current` for the request in a call, and `configure({ base, headers, transport, reply })` for the client. `rpc({ entry })` takes the app's own server module - routes, `scheduled` and Durable Objects beside the calls, which it gets from `@expressive/rpc/calls` - runs it on the dev server and bundles it as the server. Arguments and results carry `Date`, `BigInt`, `NaN`/`Infinity`, `Map`, `Set`, `Uint8Array` and `undefined` in arrays, tagged inside plain JSON.
