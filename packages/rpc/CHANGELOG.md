# @expressive/rpc

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
