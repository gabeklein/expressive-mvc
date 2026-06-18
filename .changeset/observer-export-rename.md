---
"@expressive/mvc": minor
"@expressive/react": minor
---

Rename the `Observable` export to `Observer`.

The exported symbol is the observer/dispatch type (`Observer.Signal`, `Observer.Notify`, etc.); it was surfaced under the wrong name. The export is renamed clean - import `Observer` instead of `Observable`. The internal `Observable` marker interface (an object that may carry an `Observer`) is unaffected and remains internal.
