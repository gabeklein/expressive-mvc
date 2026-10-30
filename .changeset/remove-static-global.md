---
'@expressive/mvc': minor
'@expressive/router': minor
'@expressive/inspect': patch
---

Remove `static global` and the `Model.Global` type. An instance no longer registers itself into `Context.root`; give the app one root model that owns its shared state and provide it with `<Component for>`, or add an instance to root explicitly - `X.new((self) => Context.root.add(self, true))` removes the entry when it is destroyed. A class that still declares `static global` throws on construction, naming the class. Root's implicit-add eviction goes with it - root now resolves like any other context.

`Router` and `BrowserRouter` no longer declare `global`, so a top-level `BrowserRouter.new()` is no longer found by every `Route`; mount `<BrowserRouter>` at the app's root, or add it to root explicitly. Inspect counts any instance held in root as claimed.
