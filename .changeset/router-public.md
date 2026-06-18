---
"@expressive/router": patch
---

Publish `@expressive/router`. The package now depends only on `@expressive/mvc` at runtime - the `@expressive/react` adapter moves to a dev dependency (used by the test host, not shipped). Its `Component`s render under any `@expressive/mvc` host.
