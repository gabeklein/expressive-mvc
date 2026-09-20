---
"@expressive/mvc": patch
---

A suspending effect now holds the `pending()` call which updated it, rather than releasing on the replay that suspended.

An effect which throws a promise is retried through MVC dispatch when that promise settles. Until now the throw was caught inside the replay, so the call saw a clean return and settled while the effect was still waiting - the one arm of `Promise.all` over subscribers which was incomplete. The retry retains the original pending scope, including updates it causes downstream. Pending updates arriving during suspension join the same hold and remain squashed into that retry. Its hold is released when a retry returns, when the effect is cancelled, or when its state is destroyed; cancellation also prevents a settled promise from reviving the effect.
