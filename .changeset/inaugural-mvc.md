---
"@expressive/mvc": minor
---

**Milestone release.** `@expressive/mvc` now ships the renderer-agnostic `Component`, completing the "MVC" the package is named for. This is the first publish since `0.73.1` and folds in a large body of architectural work.

**`Component` in core (#100, #111).** The reactive `Component` - previously living in `@expressive/react` - is now a layer on `State` in the core package. A renderer is no longer assumed: `@expressive/react` becomes a thin adapter that completes the class through documented seams. Subclasses may override `render` and have it **compose up the prototype chain** with no `super.render()` call - each ancestor wraps the subclass output as `children`, base-outermost, lazily and reactively (#111, breaking).

**Host-agnostic JSX runtime (#127).** `@expressive/mvc` is now a standalone JSX pragma (`jsxImportSource: "@expressive/mvc"`). The new `@expressive/mvc/jsx-runtime` entry forwards `jsx`/`jsxs`/`jsxDEV`/`Fragment` to a host table registered by an adapter (one host per build). Element-introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`) let agnostic libraries walk JSX without a renderer.

**Reactive collections (#78).** New `hot()` helper - a shallow reactive proxy for arrays/objects with keyed read-subscription and native mutating methods.

**Robustness.** Reads of a destroyed instance now settle to last-known values instead of throwing, while writes and subscriptions stay loud (#121); instances discarded before a React commit are now destroyed (#122).

**Breaking / surface changes.**
- Package renamed back to `@expressive/mvc` from the interim `@expressive/state` (#104).
- `Observable` export renamed to `Observer` (#151).
- Removed the redundant `get(key, callback)` overload; use `set()` for event listening (#102).
- ESM-only; CJS output dropped (#79).
