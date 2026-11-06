---
"@expressive/steps": minor
---

First release. `class X extends Steps` makes a Model runnable: every method is a step, a step schedules the next by calling it, and fields carry data between them. `run(...args)` is the entry - it schedules, `await this` waits for the run, and its return is the typed result of `x.run()` and `await x`. Steps compose into sequences, parallel groups, mapped groups, inline steps and waits answered from outside or by a watcher; each step is atomic and registers its own undo, so a failure unwinds what committed. `.catch()` recovers a branch, `this.then.slot()` gates concurrency, `this.then.back()` unwinds on command, `this.then.commit()` marks a point of no return. Runs repeat and queue; status, queue and waits are reactive on `this.then`. In-process only - no durable persistence yet.
