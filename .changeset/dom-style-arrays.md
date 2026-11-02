---
"@expressive/dom": minor
---

A rule, condition or subcomponent body in a `style()` or `macro()` map may be an array of maps, merged in order with falsy entries skipped - `_select: [field, { color: 'red' }]` instead of a spread. Layers now merge a descendant scope rule by rule rather than the later layer replacing it.
