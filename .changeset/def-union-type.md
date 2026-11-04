---
"@expressive/mvc": patch
---

`def<T>` no longer types a union including `undefined` as `unknown` - `def<X | undefined>` fields keep `X | undefined`.
