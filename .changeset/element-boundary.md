---
"@expressive/mvc": minor
"@expressive/dom": minor
---

A State element owns a boundary from `fallback` or `catch` attributes as well as members: `<Page fallback={<Spinner />} catch={(error, page) => …} />`. An attribute takes precedence and still passes through to a field of that name. `State.Props` types both, narrowed to a declared member's type. Function components and placed instances are unchanged.
