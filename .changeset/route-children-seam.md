---
"@expressive/router": minor
---

Rename the `Route` child-contribution seam from `protected get nested()` to `protected get children()`. The getter reads more naturally as the scope's effective children (its default is `props.children`), and now coexists cleanly with the `children` prop thanks to the read-only-computed assignment fix in `@expressive/mvc`. Subclasses overriding the seam must rename `get nested()` to `get children()` and `super.nested` to `super.children`.
