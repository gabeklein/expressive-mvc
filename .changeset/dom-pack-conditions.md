---
"@expressive/dom": minor
---

A `Style` pack names conditions with `$name` fields (`$mobile = '@media (max-width: 900px)'`), used as `$mobile: { … }` keys in any map styled by that pack and overridable by a subclass. The fallback method for keys no macro handles is renamed from `'*'` to `default`.
