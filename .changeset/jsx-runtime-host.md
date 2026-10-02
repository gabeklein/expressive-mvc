---
'@expressive/mvc': minor
'@expressive/react': patch
'@expressive/dom': patch
'@expressive/router': patch
'@expressive/inspect': patch
---

**Breaking:** `@expressive/mvc/runtime` is removed. Host seams (`host`, `HostRuntime`, `Host`, `childrenOf`, `isElement`, `typeOf`, `propsOf`) move to `@expressive/mvc/jsx-runtime` beside the transform contract (`jsx`, `jsxs`, `jsxDEV`, `Fragment`, `JSX`); class HMR moves to its own subpath, `@expressive/mvc/hot`, exporting `accept` and `replaced`.

- Host seam imports from `@expressive/mvc/runtime` → `@expressive/mvc/jsx-runtime`.
- `import { hot } from '@expressive/mvc/runtime'` → `import * as hot from '@expressive/mvc/hot'`.
- `declare module '@expressive/mvc/runtime'` augmentations of `Host` → `declare module '@expressive/mvc/jsx-runtime'`.

Adapters, router, inspect, and the Vite plugins import the new path.
