---
'@expressive/mvc': minor
'@expressive/react': patch
'@expressive/dom': patch
'@expressive/router': patch
'@expressive/inspect': patch
---

**Breaking:** `@expressive/mvc/runtime` merges into `@expressive/mvc/jsx-runtime`, and the `./runtime` subpath is removed. The module now carries the transform contract (`jsx`, `jsxs`, `jsxDEV`, `Fragment`, `JSX`) and the host seams beside it (`host`, `HostRuntime`, `Host`, `childrenOf`, `isElement`, `typeOf`, `propsOf`, `hot`).

- Imports from `@expressive/mvc/runtime` → `@expressive/mvc/jsx-runtime`.
- `declare module '@expressive/mvc/runtime'` augmentations of `Host` → `declare module '@expressive/mvc/jsx-runtime'`.

Adapters, router, inspect, and the Vite plugins import the new path.
