---
'@expressive/mvc': minor
---

Effects understand promises. An effect that returns one is pending until it settles: tracked changes in flight no longer re-run it mid-flight, they accumulate into a single re-run afterwards. A suspense thrown after an `await` replays like a synchronous one, a rejection reports like a synchronous throw, and a resolved function or `null` acts as cleanup or cancel.

The function returned by `state.get(effect)` is now `State.Release<R>` - callable to stop the effect, awaitable to stop it once a run completes clean and receive that run's value. The overload returning a value is generic: `await state.get(($) => $.user)` reads a tracked value once, suspending until it is available; `await state.get(async ($) => ...)` yields what the promise resolves to.
