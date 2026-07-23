---
"@expressive/mvc": patch
---

Fix a crash when a bare-constructed instance (`new X()`, not `X.new()`) activates after a foreign non-configurable own property has been installed on it - for example a React element internal like `_owner`, added by the render facade when a not-yet-activated `Component` is dropped into JSX and activated in place. Activation's field sweep now converts only *configurable* value properties into reactive ones, leaving anything non-configurable untouched instead of throwing on `defineProperty`.
