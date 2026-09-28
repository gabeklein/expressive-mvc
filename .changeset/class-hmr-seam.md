---
"@expressive/mvc": minor
---

Add `hot.accept(id, classes)` to `@expressive/mvc/runtime` - the seam build integrations bind for class HMR. An edited `State` or `Component` class is patched onto the one already loaded and returned in its place: live instances keep their values and refresh with the new methods, getters, `render` and statics, and handlers the module registered with `on()` are replaced. A change a patch cannot carry (fields, constructor, `new()`, a member switching between method and getter) returns the new class instead, so the integration reloads. The registry is keyed by module id rather than a bundler hot API, so it works in the browser and in Vite's server-side module runner alike.
