# @expressive/inspect

## 0.3.0

### Minor Changes

- [#421](https://github.com/gabeklein/expressive-mvc/pull/421) [`570613a`](https://github.com/gabeklein/expressive-mvc/commit/570613a6fdd60cf1e1820e1e46076c7df26a1c84) Record hot updates in the journal. A hot-patched instance gets a `hot` event (`key: 'patch'`) instead of an opaque symbol event, and `summary()` counts them; the Vite client marks each update (`update`, with module paths) and opens the page a full reload brings up with a `reload` event carrying the reason. `journal.hot(key, value?)` records a page-level marker. With `calls: true`, recorded methods now follow a hot patch - previously the call wrapper kept the old implementation - and methods an edit adds are recorded too.

### Patch Changes

- [#417](https://github.com/gabeklein/expressive-mvc/pull/417) [`724b803`](https://github.com/gabeklein/expressive-mvc/commit/724b80351261a899f57f1ee2d9b1a67f16f07d0e) `get` and value-form `until` read unmanaged `_` keys when addressed by name. Address-form `until` on a `_` key throws immediately, since those keys emit no frames. Whole-state views still omit them.
- Updated dependencies [[`a450c4f`](https://github.com/gabeklein/expressive-mvc/commit/a450c4f494b4fef28821c8d6382c5532886a8716), [`66abbfb`](https://github.com/gabeklein/expressive-mvc/commit/66abbfbc6034af1be394aabc82f4bb3f9989a855), [`724b803`](https://github.com/gabeklein/expressive-mvc/commit/724b80351261a899f57f1ee2d9b1a67f16f07d0e)]:
  - @expressive/mvc@0.87.0

## 0.2.0

### Minor Changes

- [#405](https://github.com/gabeklein/expressive-mvc/pull/405) [`ae00a73`](https://github.com/gabeklein/expressive-mvc/commit/ae00a7351d698bb6d9f1761b5dd457a971caf6d2) A label shared by more than one class (two modules each declaring `class Control`) now throws from `find`, `get`, `set`, `call` and `act`'s `until` instead of silently picking the first instance of either. The error lists the classes' `typeId`s; address by instance id or owner path, or give one a distinct `label()`.

  `get(address, select)` reads a selection - `{ status: true, control: { value: true } }` - as one consistent snapshot: selected keys only, descending through child States (which keep `$ref`), Maps, objects and each element of a list. Also on the bridge and relay.

- [#389](https://github.com/gabeklein/expressive-mvc/pull/389) [`2d9f0aa`](https://github.com/gabeklein/expressive-mvc/commit/2d9f0aad304397024ae7879b7126e26d0a93afe6) `health()` replaces `warnings()`: `{ orphans, collected, copies, caught }`.

  - `copies` counts loaded copies of `@expressive/mvc` - each copy adds its `State` to `globalThis[Symbol.for('@expressive/mvc')]` the first time it constructs a State. More than one means inspect sees only its own copy's States; it warns once.
  - `caught` counts `Caught` reports by case, including ones an app handler goes on to handle - inspect's `catch` joins each class as its first instance activates, ahead of app handlers registered before then. Inspect passes each report on, so behavior is unchanged. With the journal recording, each report is also a `caught` event carrying `{ case, message, stack, handled }` at any level; `summary()` counts them per instance. `journal.clear()` also zeroes the counts.

  Inspect now needs the `@expressive/mvc` release that ships `Caught` - upgrade them together.

- [#379](https://github.com/gabeklein/expressive-mvc/pull/379) [`7bec5b3`](https://github.com/gabeklein/expressive-mvc/commit/7bec5b3c767c7a06c09e6a4acac7721e372887eb) `act()` - in process, on the bridge and over the relay - settles once a macrotask passes with no new recorded frame, instead of after a single `setTimeout(0)` - work deferred through timer or promise chains now lands in the returned frames. It takes `{ until, timeout, record }`: `until` waits first for work pending on I/O - `{ [address]: value }` pairs that must each hold, or addresses that must each see a frame after the step's synchronous writes, `timeout` caps the wait (default one second) - an unmet `until` throws with the frames recorded so far, a plain timeout warns, and `record` sets filters for the window, restoring the journal's after. Over the relay it answers `settled: false` with the `pending` targets, and `missing` for those naming no instance, instead.

  Add `journal.summary(query?)` - a per-instance digest of recorded frames (keys written with counts and last values, calls, destroyed), latest first. Also on the bridge and relay.

  `until` works under an app's recording filters: its addresses join the window's recording, and the value form reads current values. A `{ record }` object already on `globalThis.__EXPRESSIVE_INSPECT__` when `install` runs arms recording from boot - set it from a driver's init script to cover a page reload.

- [#377](https://github.com/gabeklein/expressive-mvc/pull/377) [`5bccf67`](https://github.com/gabeklein/expressive-mvc/commit/5bccf6735e6b644e7be390d4395dcae89f4e9629) Rename `@expressive/inspect/playwright` to `@expressive/inspect/bridge` - it drives anything with `evaluate(fn, arg)` (Playwright, puppeteer, a wrapped CDP session). Update the import path, and call `act` where you called `around` - the bridge now uses the in-process name. `/bridge` also exports `devtools(endpoint?, pick?)`, which connects to a Chrome DevTools Protocol endpoint (a Node process under `--inspect`, or a browser with a debug port) as an `evaluate` target; `pick` is a predicate or a string matched against title and URL, and zero or several matches throw with the target list.

  Add `@expressive/inspect/vite`, a dev-server plugin that installs the inspector and relays `GET /__inspect` and `POST /__inspect/:id` (`[method, ...args]`) to open pages over Vite's HMR socket, so an agent can query the page a developer has open with `curl`. A connected page records `keys` from load unless the app sets a level, and `["act", [method, ...args], options?]` runs one call and answers `{ value, frames, settled, pending, missing }`. Dev server only; it answers local callers and refuses browser and proxied (tunnel) requests - a dev server exposed through a proxy that strips forwarding headers is its owner's to secure.

  `act` records values for its window whatever the journal level - previously only when it was off, so a `keys` recording returned frames without values.

### Patch Changes

- Updated dependencies [[`522606a`](https://github.com/gabeklein/expressive-mvc/commit/522606a7c64453cc38ebdcceab4c741a63c2a6b3), [`2d9f0aa`](https://github.com/gabeklein/expressive-mvc/commit/2d9f0aad304397024ae7879b7126e26d0a93afe6), [`451911b`](https://github.com/gabeklein/expressive-mvc/commit/451911bcf19a1117cf0bd399669a7e1af6b60129), [`99dc2e9`](https://github.com/gabeklein/expressive-mvc/commit/99dc2e9bb182dbde2ac043ff645419cfe72530d9), [`3ce41fb`](https://github.com/gabeklein/expressive-mvc/commit/3ce41fbf5c24434dd7c44484593a4ee766a221ae)]:
  - @expressive/mvc@0.86.0

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
