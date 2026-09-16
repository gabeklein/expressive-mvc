---
"@expressive/inspect": minor
---

First release of `@expressive/inspect`, an in-process inspector for State. Attach with `import '@expressive/inspect/install'` as the first import of the app entry, then query the live model graph from tests, Playwright, or the console: `find`/`roots`/`Instance` in process, `get`/`set`/`call`/`models`/`tree` across a boundary, an opt-in journal of flush-bounded frames with `cause` links and `paths`/`keys`/`types` filters, `act` and `around` to bracket a step and read back what changed, orphan separation for instances a host never committed, and label resolution that survives minified class names. `@expressive/inspect/playwright` wraps any `Page`, `Frame`, or `Locator`.
