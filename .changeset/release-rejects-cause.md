---
"@expressive/mvc": minor
---

An instance destroyed because its setup rejected - an `async new()`, a setup handler or a constructor callback - rejects awaited effects (`await state.get(() => {})`) and pending reads of required values with that error instead of `{state} is destroyed.` The error still reports to `catch` as `setup`.
