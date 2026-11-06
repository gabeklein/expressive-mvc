# Hooks - Before, After, Back

Three names are hooks: `before`, `after` and `back` - found on the same classes as steps, the most-derived declaration winning: never wrapped, never scheduled - from outside they are plain methods. Any other name, `beforeShip` included, is a step.

```ts
protected before(key: string, args: unknown[]) {}
protected after(key: string, entry: Steps.Entry) {}
```

Order around each step: `before` → step → `after`. Work for one step belongs in the step, or a branch on `key`. The after hooks see the committed entry - the runner keeps none, so a log is built here ([runner.md](runner.md#entry)). A try a [catch](catch.md) took reaches them too, its entry carrying `error` - a log shows the attempt that failed beside its replacement.

Hooks are `protected` by convention ([README.md](README.md#conventions)) and synchronous. Hooks run with the raw instance as `this`: their writes are in no entry and do not count as step work; their return is ignored and not awaited. A hook that throws fails the run. Hooks fire for `next`, steps answering a wait and inline steps (key `then`); once per step - a catch handler is its own step - and not for undos - an answer to a [returned wait](undo.md#a-returned-wait) included.

`before`/`after`/`back` are declared on `Steps` - `override` checks their signatures ([contract.md](contract.md)).

## `back`

```ts
protected back(reason: unknown) {
  this.notice = `Order ${this.cart.id} was not placed: ${reason instanceof Error ? reason.message : reason}`;
}
```

Runs once after each unwind completes - halted at an irreversible entry or not. After [`this.then.back(step, reason)`](undo.md#back), `reason` is its second argument (else `undefined`) and the run continues; a throw from it fails the run, and that failure's unwind does not call `back` again. After a failure or `stop(true)` - not `stop()` - it runs before the run rejects, and `reason` is what the run rejects with: the failure, an undo's throw, or the `'Stopped'` error; a throw from it replaces that. Raw instance as `this`, writes unjournaled, return ignored.

## Cleanup

There is no outcome hook - cleanup on every outcome is `next`'s tail ([runs.md](runs.md#next-and-the-result)): `try`/`catch`/`finally` around `await this`, run after the unwind and `back`:

```ts
async next(id: string) {
  this.render(id);

  try {
    await this;
  } catch (error) {
    await rows.mark(id, this.then.status);   // 'failed' or 'stopped'
    throw error;
  } finally {
    this.preview.close();
  }
}
```

Two runs have no tail: one whose `next` never awaits `this` (the chained style), and one failing before `next` reaches `await this`. Put cleanup they need in the step that made the mess - its undo.
