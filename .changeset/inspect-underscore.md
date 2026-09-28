---
'@expressive/inspect': patch
---

`get` and value-form `until` read unmanaged `_` keys when addressed by name. Address-form `until` on a `_` key throws immediately, since those keys emit no frames. Whole-state views still omit them.
