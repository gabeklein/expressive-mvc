---
"@expressive/mvc": minor
"@expressive/react": minor
"@expressive/router": minor
---

Declare `@expressive/mvc` as a peer dependency rather than a direct one. A caret range on a 0.x version resolves to a narrow window, so an app installing `@expressive/mvc` itself could end up with a second copy - two `State` classes, two context registries, and `instanceof` failing across the boundary. As a peer there is exactly one resolution, and a mismatch surfaces at install rather than silently at runtime.

Core re-exports from `@expressive/react` and `@expressive/preact` are now marked `@deprecated`, along with the default export of `State` in all three packages. Import `{ State }`, `Component` and instructions from `@expressive/mvc`; take `Provider` and `Consumer` from the adapter, and import the adapter once from an entry module so it registers. Nothing is removed yet - the default alias in particular hides adapter-augmented `State.*` types, so the named import is the correct one regardless.
