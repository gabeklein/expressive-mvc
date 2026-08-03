---
"@expressive/react": patch
---

Fix `{instance}` placement being tree-shaken out of production bundles.

`Component.prototype.$$typeof` - the descriptor that lets a Component instance
render as `{instance}` - is installed by a shared chunk that the published
`sideEffects` manifest could not name, so bundlers dropped it. Any consumer
build that shook away `has` and `map` lost placement entirely and threw
"Objects are not valid as a React child" at render, in production builds only.

Shared chunks now emit under a `chunk-` prefix and the manifest covers them by
pattern, so no future chunk can fall outside it. `dist/has.js` and `dist/map.js`
stay tree-shakeable; the export map and published entry paths are unchanged.
