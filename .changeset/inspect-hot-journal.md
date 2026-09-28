---
"@expressive/inspect": minor
---

Record hot updates in the journal. A hot-patched instance gets a `hot` event (`key: 'patch'`) instead of an opaque symbol event, and `summary()` counts them; the Vite client marks each update (`update`, with module paths) and opens the page a full reload brings up with a `reload` event carrying the reason. `journal.hot(key, value?)` records a page-level marker. With `calls: true`, recorded methods now follow a hot patch - previously the call wrapper kept the old implementation - and methods an edit adds are recorded too.
