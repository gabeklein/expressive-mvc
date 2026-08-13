---
"@expressive/mvc": patch
---

A suspending effect now holds the `pending()` call which updated it, rather than releasing on the replay that suspended.

An effect which throws a promise is retried when that promise resolves. Until now the throw was caught inside the replay, so the call saw a clean return and settled while the effect was still waiting - the one arm of `Promise.all` over subscribers which was incomplete. The hold is taken once per suspension run and released when a retry returns, when the effect is cancelled, or when its state is destroyed.
