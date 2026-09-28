---
'@expressive/router': patch
---

Published types no longer import the unexported `@expressive/mvc/state` subpath, so projects with `skipLibCheck: false` type-check, and `Router.global` no longer resolves to `any`.
