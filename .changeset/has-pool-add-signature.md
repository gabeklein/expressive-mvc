---
"@expressive/mvc": patch
---

`has(Type)` and `has(Type, key)` now return `has.Create<T, A>`, a pool whose `add` is typed as two overloads - spawn from the key value (or constructor args) and admit an instance - instead of a single rest-tuple union, so editor hovers read `add(from: SessionInfo): Row` rather than `add(...args: [SessionInfo] | [Row]): Row`.
