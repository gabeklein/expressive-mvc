# @expressive/dev

## 0.1.3

### Patch Changes

- [#678](https://github.com/gabeklein/expressive/pull/678) [`f59d49b`](https://github.com/gabeklein/expressive/commit/f59d49be2daeb6328b31196153290ec333ec7033) A route module's `export default Name` naming a class is read as its scope class, not as an entry hook.

- [#679](https://github.com/gabeklein/expressive/pull/679) [`ea0f0c6`](https://github.com/gabeklein/expressive/commit/ea0f0c63ea5d1a689084a6bc170f47087b0c05f0) Agents read each package's skill straight from `node_modules/@expressive/<pkg>/skills/`, so linking skills in with `skills experimental_sync` is no longer needed. Point an agent at them with a line in `AGENTS.md`, or `npx skills add gabeklein/expressive` for a small skill that says where they are. Skills now name each other in plain text (`expressive-mvc/component.md#props`) instead of linking a side-by-side install, and `@expressive/dev` drops its `skills` field.
- Updated dependencies [[`2e3f7c7`](https://github.com/gabeklein/expressive/commit/2e3f7c7c283b75ba2e64ffd2a58df9ab68cb4d58), [`782f0fc`](https://github.com/gabeklein/expressive/commit/782f0fc52c2b401b032d3dc3482f9e00c688f95a), [`bd24d3a`](https://github.com/gabeklein/expressive/commit/bd24d3adc98733f2f474bd959f8bde44e76cf3a3), [`9923150`](https://github.com/gabeklein/expressive/commit/9923150a93702b7e6bfb326af29889670b3f5f59), [`40a1ef0`](https://github.com/gabeklein/expressive/commit/40a1ef0ba97257ce936ff318b6768f600c2910e7), [`3042161`](https://github.com/gabeklein/expressive/commit/3042161db2e9c77999826f84cb9fc60a9736a3b2), [`ea0f0c6`](https://github.com/gabeklein/expressive/commit/ea0f0c63ea5d1a689084a6bc170f47087b0c05f0)]:
  - @expressive/dom@0.12.0
  - @expressive/router@0.10.4
  - @expressive/rpc@0.2.0
  - @expressive/mvc@0.94.3
  - @expressive/inspect@0.6.4

## 0.1.2

### Patch Changes

- [#673](https://github.com/gabeklein/expressive/pull/673) [`925f17e`](https://github.com/gabeklein/expressive/commit/925f17ef9c220739333a25dee528911a7a06e0ce) JSDoc on `Route`, `Router`, `NotFound`, `config`, `serve` and the `/vite` entry; the skill names what the root entry re-exports and links the router, dom and inspect skills.

- [#668](https://github.com/gabeklein/expressive/pull/668) [`f9eabf1`](https://github.com/gabeklein/expressive/commit/f9eabf14a39c91e069072dacbaff02657289685f) Declare the skills of dom, inspect, router and rpc in a `skills` field, so `skills sync` installs them for a project that only lists `@expressive/dev`.

- [#651](https://github.com/gabeklein/expressive/pull/651) [`173a60c`](https://github.com/gabeklein/expressive/commit/173a60ce8245f509da4a1735c4788472dea5462e) Ship each package's agent skill in the package, at `skills/expressive-<pkg>/SKILL.md`, so the docs an agent reads match the installed version. `npx skills experimental_sync` links them into `.claude/skills/` and `.agents/skills/`; `expressive-mvc` holds the core, and each package's skill links its siblings as installed side by side. On expressive.dev the skills move to `/llm/expressive-<pkg>/`, with the old `/llm/` paths redirecting.

- [#672](https://github.com/gabeklein/expressive/pull/672) [`f0e6e70`](https://github.com/gabeklein/expressive/commit/f0e6e7033237aef547d4088e69df1ced13e6880b) Skill corrections: inspect's `caught` kinds and `site`, rpc's `Redirect` status, router's guard rejection and `Redirect` timing, dom's status, dev's hand-written Vite config needing `inspect()`, and steps linking the mvc skill.

- [#668](https://github.com/gabeklein/expressive/pull/668) [`f9eabf1`](https://github.com/gabeklein/expressive/commit/f9eabf14a39c91e069072dacbaff02657289685f) Fix the skill's frontmatter, which was invalid YAML, so skill installers skipped it.
- Updated dependencies [[`5bda16e`](https://github.com/gabeklein/expressive/commit/5bda16e00c97200b7eca0d5073970fc0d8631f01), [`1ec8ba8`](https://github.com/gabeklein/expressive/commit/1ec8ba8fe5e2d765718937e45a4e3c890343092a), [`bc936ea`](https://github.com/gabeklein/expressive/commit/bc936eaa8126b9ec6918fb670ac36e6a626b2d1c), [`5fec34c`](https://github.com/gabeklein/expressive/commit/5fec34c05a268718f4dec2bdafd13de22264821c), [`11e3c48`](https://github.com/gabeklein/expressive/commit/11e3c48fbb1f27e80128a5209c5ad2ff099ddd64), [`173a60c`](https://github.com/gabeklein/expressive/commit/173a60ce8245f509da4a1735c4788472dea5462e), [`a8659ff`](https://github.com/gabeklein/expressive/commit/a8659ffa58dcdf836d01e104b8a2c1ef17b574f0), [`f0e6e70`](https://github.com/gabeklein/expressive/commit/f0e6e7033237aef547d4088e69df1ced13e6880b), [`f9eabf1`](https://github.com/gabeklein/expressive/commit/f9eabf14a39c91e069072dacbaff02657289685f)]:
  - @expressive/dom@0.11.0
  - @expressive/mvc@0.94.2
  - @expressive/router@0.10.3
  - @expressive/inspect@0.6.3
  - @expressive/rpc@0.1.1

## 0.1.1

### Patch Changes

- [#654](https://github.com/gabeklein/expressive-mvc/pull/654) [`bd67894`](https://github.com/gabeklein/expressive-mvc/commit/bd678942e7cb6a1688ff9ada6531624aa8dfd06d) Installs from npm. 0.1.0 was published with `workspace:^` ranges for `@expressive/dom`, `@expressive/rpc`, `@expressive/router` and `@expressive/inspect`, which npm cannot resolve outside this repo.

## 0.1.0

### Minor Changes

- [#644](https://github.com/gabeklein/expressive-mvc/pull/644) [`bdc4c77`](https://github.com/gabeklein/expressive-mvc/commit/bdc4c77db1ed0b52c26b0cba1ce03c306416d3d4) First release. `expressive dev` and `expressive build`: file-based routes from `app/` on `@expressive/dom` and `@expressive/router`, `remote.ts` sidecars served through `@expressive/rpc`, server Models seated per route folder, and a Node service in `dist/server`. Twins - server Models mirrored on the client - are experimental.

### Patch Changes

- Updated dependencies [[`ac9785c`](https://github.com/gabeklein/expressive-mvc/commit/ac9785cb36540a46c41c9a90ecf0b5adcb715edb), [`bdc4c77`](https://github.com/gabeklein/expressive-mvc/commit/bdc4c77db1ed0b52c26b0cba1ce03c306416d3d4)]:
  - @expressive/dom@0.10.1
  - @expressive/rpc@0.1.0
