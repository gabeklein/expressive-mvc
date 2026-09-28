---
'@expressive/mvc': minor
---

Fields prefixed with `_` are no longer managed. They are defined non-enumerable, never notify, stay writable after destroy, and are excluded from `get()`, iteration, `ref(this)`, and `State.Field` / `State.Values`. Overlays (constructor args, `set({ ... })`, Component props) still assign them. A `_` prototype getter stays a plain accessor rather than a computed, and an instruction on a `_` key throws.

**Breaking:** a `_` field used as reactive state - such as a backing field behind a getter - no longer updates subscribers. Rename it without the prefix.
