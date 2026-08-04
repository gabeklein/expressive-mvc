---
"@expressive/react": patch
---

Fix an unloadable published dist: `import '@expressive/react'` threw
`ERR_MODULE_NOT_FOUND` under native Node ESM.

The build declared `./adapter` external, so `dist/index.js` shipped an
extensionless `from "./adapter"`. Bundlers tolerate that; Node's ESM resolver
does not, which broke plain-node and native-ESM SSR consumers - the package
could only be imported through a bundler. The adapter is already its own entry,
so dropping the external emits `./adapter.js` with no change to chunking or
public surface.
