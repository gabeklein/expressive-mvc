---
"@expressive/mvc": minor
---

Add `hot` to `@expressive/mvc/runtime` - the seam build integrations bind for class HMR. An edited `State` or `Component` class is patched onto the one already loaded: live instances keep their values and refresh with the new methods, getters, `render` and statics, and handlers the module registered with `on()` are replaced. A change a patch cannot carry (fields, constructor, `new()`, a member switching between method and getter) asks for a reload. `hot.inject` produces the code a plugin appends; `hot.accept` and `hot.verify` run in it. The registry is keyed by module id rather than a bundler hot API, so it works wherever modules re-run in one process.
