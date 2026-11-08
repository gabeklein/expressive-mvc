# @expressive/dev

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
