---
"@expressive/mvc": patch
---

`has(Type)` now returns `has.Create<T, A>` and `has(Type, key)` returns `has.From<T, V>`, pools whose `add` is typed as two overloads - spawn from the key value (or constructor args) and admit an instance - instead of a single rest-tuple union, so editor hovers read `add(from: SessionInfo): Row` rather than `add(...args: [SessionInfo] | [Row]): Row`.
