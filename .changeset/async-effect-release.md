---
'@expressive/mvc': minor
---

Effects understand promises. An effect that returns one is pending until it settles: tracked changes in flight no longer re-run it mid-flight, they accumulate into a single re-run afterwards. A suspense thrown after an `await` replays like a synchronous one, and a rejection reports like a synchronous throw. What a promise resolves to is a value only - cleanup and cancel stay with sync returns.

The function returned by `state.get(effect)` is now `State.Release<R>` - callable to stop the effect, awaitable to stop it once it settles and receive the latest run's value. A run in flight, queued or suspended is waited for. Only an async effect yields a value: `await state.get(async ($) => $.user)` reads a tracked value once, suspending until it is available. A sync effect resolves `undefined`.
