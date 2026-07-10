---
"@expressive/react": patch
---

Warn when a subscribed function component stops re-rendering under React Compiler. `use()`, `State.use()`, and `State.get()` are hooks the compiler does not recognize as such, so it memoizes the call on its reference-stable argument and runs it only on mount - the internal hooks are skipped on later renders and updates are silently dropped. The adapter now detects this (a watched value changed but the hook body was not re-invoked) and logs a console warning pointing at the `"use no memo"` directive. `Component` classes are unaffected and need no opt-out.
