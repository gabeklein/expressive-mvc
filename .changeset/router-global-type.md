---
'@expressive/router': patch
---

Published types no longer import the unexported `@expressive/mvc/state` subpath. `Router.global` and `BrowserRouter.global` are now typed as `State.Global`, so projects with `skipLibCheck: false` type-check and `global` no longer resolves to `any`.
