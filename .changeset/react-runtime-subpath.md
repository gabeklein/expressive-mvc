---
"@expressive/react": minor
---

Rename the `@expressive/react/state` subpath to `@expressive/react/runtime`.

This entry exposes the host-agnostic runtime layer (the `Runtime` seam, hooks,
context, and `State`) that adapters build on. The name now reflects its
contents - it is the render runtime, not a "state" module. The old `/state`
subpath is removed; import from `@expressive/react/runtime` instead.
