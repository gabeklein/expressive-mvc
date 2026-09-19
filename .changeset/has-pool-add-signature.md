---
"@expressive/mvc": patch
---

`has(Type)` and `has(Type, key)` pools now type `add` as two overloads - spawn from the key value (or constructor args) and admit an instance - instead of a single rest-tuple union, so editor hovers read `add(from: SessionInfo): Row` rather than `add(...args: [SessionInfo] | [Row]): Row`.
