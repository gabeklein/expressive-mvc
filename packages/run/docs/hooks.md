# Hooks - Before, After, Back, Exit

Methods named `before`/`after`, or those followed by an uppercase letter (`beforeShip`), `back` and `exit`, are hooks - found on the same classes as steps: up to `base`, else the most-derived class only ([job.md](job.md#escape-hatch-runthis-options)): never wrapped, never scheduled - from outside they are plain methods. `beforehand` is a step.

```ts
protected before(key: string, args: unknown[], skip: boolean) {}
protected after(key: string, entry: Runner.Entry, skip: boolean) {}

protected beforeShip(skip: boolean, chargeId: string) {}
protected afterShip(skip: boolean, entry: Runner.Entry) {}
```

Order around each step: `before` → `before<Step>` → step → `after<Step>` → `after`. The after hooks see the committed entry. `skip` is always `false` at this tier - it is reserved for replay in the job tier.

Hooks are `protected` by convention ([README.md](README.md#conventions)) and synchronous. Hooks run with the raw instance as `this`: their writes are in no entry and do not count as step work; their return is ignored and not awaited. A hook that throws fails the run. Hooks fire for `next`, `end`, steps answering a wait and inline steps (key `then`); not per retry, and not for undos - an answer to a [returned wait](undo.md#a-returned-wait) included.

A per-step hook without its step throws when the instance is created: `afterShip has no step ship.` On a `Job`, `before`/`after`/`back`/`exit` are declared - `override` checks their signatures ([job.md](job.md)); per-step hooks and `run(this)` class hooks are unchecked - [options](#hooks-as-options) are typed.

## Hooks as options

```ts
then = run(this, {
  before(step, args, skip) {},
  after(step, entry, skip) {},
  back(reason) {},
  exit(outcome) {}
});
```

`before`, `after`, `back` and `exit` may be passed to `run(this, options)` - typed against the instance: a wrong signature fails to compile, `exit`'s `result` is typed by `end`. Raw instance as `this`; same rules as the class hooks. No per-step option hooks.

With both, the class's runs first: `before` → option `before` → `before<Step>` → step → `after<Step>` → `after` → option `after`; `back` → option `back`; `exit` → option `exit`. A throw from `before`/`after` fails the run and skips the rest; `back` and `exit` each run - a throw from either replaces `error`.

## `back`

```ts
protected back(reason: unknown) {
  this.notice = `Order ${this.cart.id} was not placed: ${reason instanceof Error ? reason.message : reason}`;
}
```

Runs once after each unwind completes - halted at an irreversible entry or not. After [`this.then.back(step, reason)`](undo.md#back), `reason` is its second argument (else `undefined`) and the run continues; a throw from it fails the run. After a failure or `stop(true)` - not `stop()` - it runs before the run rejects, and `reason` is what the run rejects with: the failure, an undo's throw, or the `'Stopped'` error; a throw from it replaces that. Raw instance as `this`, writes unjournaled, return ignored.

## `exit`

```ts
protected exit(outcome: Runner.Outcome) {
  if (outcome.status != 'done') this.session.close();
}
```

Runs once per run, on every terminal outcome - last, after `end`, the unwind and `back`, before the run's Promise settles:

```ts
type Outcome<R = unknown> =
  | { status: 'done'; result: R }
  | { status: 'failed'; error: unknown }
  | { status: 'stopped'; error: unknown };
```

`result` is the run's result; `error` is what the run rejects with - the failure, an undo's or `back`'s throw, or the `'Stopped'` error, carrying `stop`'s reason as `cause`. Runs for `stop()` with or without `undo`; not for queued runs dropped by `stop()` - they never started. Raw instance as `this`, writes unjournaled, return ignored.

A throw from it replaces `error`, as `back`'s does: the run rejects with it. On a `done` run, the result is dropped - status `failed`, `error` set, nothing unwound.

Not `finally` - the instance is a thenable, so that name would read as `Promise.prototype.finally`. On a `Job`, declare it `exit(outcome: Runner.Outcome<R>)` to type `result` - the declaration takes `Runner.Outcome`, so any `R` checks.

