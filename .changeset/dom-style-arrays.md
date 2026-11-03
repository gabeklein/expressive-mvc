---
"@expressive/dom": minor
---

A rule, condition or subcomponent body in a `style()` map may be an array of maps, merged in order at every depth with falsy entries skipped - `_bar: [tabs, { [wide]: { _button: { height: '30px' } } }]` instead of re-spreading each nested level.

Repeated `style()` layers now merge nested `_` scopes rule by rule; previously a later layer's `_item` replaced an earlier layer's.
