# Hooks - Before, After, Back

Methods named `before`/`after`, or those followed by an uppercase letter (`beforeShip`), and `back`, are hooks: never wrapped, never scheduled - from outside they are plain methods. `beforehand` is a step.

```ts
protected before(key: string, args: unknown[], skip: boolean) {}
protected after(key: string, entry: Runner.Entry, skip: boolean) {}

protected beforeShip(skip: boolean, chargeId: string) {}
protected afterShip(skip: boolean, entry: Runner.Entry) {}
```

Order around each step: `before` → `before<Step>` → step → `after<Step>` → `after`. The after hooks see the committed entry. `skip` is always `false` at this tier - it is reserved for replay in the job tier.

Hooks are `protected` by convention ([README.md](README.md#conventions)) and synchronous. Hooks run with the raw instance as `this`: their writes are in no patch and do not count as step work; their return is ignored and not awaited. A hook that throws fails the run. Hooks fire for `next`, `end`, steps answering a wait and inline steps (key `then`); not per retry, and not for undos - an answer to a [returned wait](undo.md#a-returned-wait) included.

A per-step hook without its step throws when the instance is created: `afterShip has no step ship.` On a `Job`, `before`/`after`/`back` are declared - `override` checks their signatures ([job.md](job.md)); per-step hooks and `run(this)` classes are unchecked.

## `back`

```ts
protected back(error: unknown) {
  this.notice = `Order ${this.cart.id} was not placed: ${(error as Error).message}`;
}
```

Runs once after an unwind completes - halted at an irreversible entry or not - before the run rejects. `error` is what the run rejects with: the failure, an undo's throw, or the `'Stopped'` error. Runs for a failure and `stop({ undo: true })`; not for `stop()`. Raw instance as `this`, writes unjournaled, return ignored. A throw from it replaces `error` and the run rejects with that.
