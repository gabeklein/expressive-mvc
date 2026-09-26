---
"@expressive/react": minor
"@expressive/router": minor
---

Declare `@expressive/mvc` as a peer dependency rather than a direct one. A caret range on a 0.x version resolves to a narrow window, so an app installing `@expressive/mvc` itself could end up with a second copy - two `State` classes, two context registries, and `instanceof` failing across the boundary. As a peer there is exactly one resolution, and a mismatch surfaces at install rather than silently at runtime.
