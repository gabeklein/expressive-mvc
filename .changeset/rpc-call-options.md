---
"@expressive/rpc": minor
---

`withOptions({ signal, timeout }, start)` cancels or times out the calls `start` makes: `withOptions({ signal }, () => list())`. An abort rejects with the signal's reason, a timeout with a `TimeoutError`.
