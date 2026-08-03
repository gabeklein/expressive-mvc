---
"@expressive/mvc": patch
---

`event(state, null)` (exported via `@expressive/mvc/observable`) now honors a terminal event only when the target owns its observer. Previously a derived object - `Object.create(subject)` or a subscriber proxy - resolved the subject's observer through the prototype chain and cleared the real subject's listeners, leaving it silently deaf while the null write landed on the throwaway object. Such calls are now inert; legitimate destruction (`State.set(null)`, owner teardown) is unaffected, as every valid terminal call already arrives holding the slot owner.
