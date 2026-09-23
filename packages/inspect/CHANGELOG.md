# @expressive/inspect

## 0.1.1

### Patch Changes

- Updated dependencies [[`94e741a`](https://github.com/gabeklein/expressive-mvc/commit/94e741a9eace7979b02bd0dda54c9037385c02d8), [`43febba`](https://github.com/gabeklein/expressive-mvc/commit/43febbab17359b099554dfb1a561cf3e463237d5), [`bfdf4ea`](https://github.com/gabeklein/expressive-mvc/commit/bfdf4eaf3cb06ccd8fbdb3d5813a6e45d2d39e53), [`397dae7`](https://github.com/gabeklein/expressive-mvc/commit/397dae7060d9f9ad0ecb657b492b844a1d77b0de), [`d0ea0ed`](https://github.com/gabeklein/expressive-mvc/commit/d0ea0ed4a91db45dd8dd3173975d8cd8d1b87826)]:
  - @expressive/mvc@0.85.0

## 0.1.0

### Minor Changes

- [#351](https://github.com/gabeklein/expressive-mvc/pull/351) [`41a61bd`](https://github.com/gabeklein/expressive-mvc/commit/41a61bd567700392adff8ce2f671725b6e2418ed) First release of `@expressive/inspect`, an in-process inspector for State. Attach with `import '@expressive/inspect/install'` as the first import of the app entry, then query the live model graph from tests, Playwright, or the console: `find`/`roots`/`Instance` in process, `get`/`set`/`call`/`models`/`tree` across a boundary, an opt-in journal of flush-bounded frames with `cause` links and `paths`/`keys`/`types` filters, `act` and `around` to bracket a step and read back what changed, orphan separation for instances a host never committed, and label resolution that survives minified class names. `@expressive/inspect/playwright` wraps any `Page`, `Frame`, or `Locator`.

### Patch Changes

- Updated dependencies [[`df641d7`](https://github.com/gabeklein/expressive-mvc/commit/df641d7ca422bb77beee1306b352acf8ef89e376), [`c6c06dd`](https://github.com/gabeklein/expressive-mvc/commit/c6c06dd99e5d82f63b9fe904ec9dfaeeeb02f48d)]:
  - @expressive/mvc@0.84.3
