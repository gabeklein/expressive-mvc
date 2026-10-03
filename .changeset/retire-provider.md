---
'@expressive/react': minor
'@expressive/dom': minor
---

`Provider` is deprecated in `@expressive/react` and removed from `@expressive/dom`. Use `<Component for={…}>` from `@expressive/mvc`, which provides one State per element; compose a parent State in place of `for={{ … }}`. `Consumer` is removed from both: read with `X.get()` in a function component.
