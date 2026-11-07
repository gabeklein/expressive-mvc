---
"@expressive/steps": minor
---

First release. `class X extends Steps` makes a Model runnable: every method is a step, a step schedules the next by calling it, and fields carry data between them. `run(...args)` is the entry - it schedules, `await this` waits for the run, and its return is the typed result of `x.run()` and `await x`. Steps compose into sequences, parallel groups, mapped groups, inline steps and waits answered from outside or by a watcher; each step is atomic and registers its own undo - `this.then.undo(this.release(hold))` - so a failure unwinds what committed. `.catch(handler)` recovers a branch - a step method is recorded, a function stays process-local, and `this.then.retry()` replays the failed step with its args; `this.then({ max, after, key })` is a gate for concurrency and delay, `this.then.commit()` marks a point of no return. Runs repeat and queue; status, queue and waits are reactive on `this.then`. In-process only - no durable persistence yet.
