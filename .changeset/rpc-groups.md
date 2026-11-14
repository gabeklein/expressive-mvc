---
"@expressive/rpc": minor
---

A server module may export groups - objects of calls and Error classes imported from elsewhere in `dir` - and re-export them. Each call keeps its defining module's path, id and gates. The new `test` option narrows which modules under `dir` are server modules: the rest stay plain, stubbed only for the calls a server module groups or re-exports, and a folder's gate is the default of its index only when `test` selects it.
