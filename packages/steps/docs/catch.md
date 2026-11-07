# Catch - Recovery per Branch

A token issued in a step - a step call, a group, an inline step, a wait - takes `.catch(handler?, ...args)`. It returns the same token, still one plan item and not awaitable. The token and everything it schedules, transitively, is its branch. When a step in the branch throws, the run does not fail:

1. The failing step's own writes are restored, as always; it is journaled `{ id, key, args, next: [], wrote: [], error }`.
2. The rest of the branch is discarded: pending items dropped, open waits released, slots cancelled, steps in flight aborted - they settle and commit.
3. The branch unwinds as a failed run would ([undo.md](undo.md#the-unwind)): compensations newest first, halting at a `committed` or irreversible entry. Outside the branch nothing is touched - parallel siblings keep their writes.
4. The handler, if any, runs in the branch's place, seeing the branch's state as it failed. Once its body returns, the branch's fields are restored - except keys it wrote - before what it scheduled runs. The plan then continues with the next item, the branch counting as done.

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.then.catch(this.release, hold);
  this.pay().catch(this.noCourier);
}

protected async noCourier(error: unknown) {
  if (!(error instanceof NoCourier)) throw error;

  this.notice = 'backordered';
  this.backorder();
}
```

- `.catch()` - the branch is skipped. A group whose members each catch settles with what succeeded.
- `.catch(this.step)` - that step runs given the error, then the failed token's args: `scan(site).catch(this.skip)` → `skip(error, site)`. A group's or an inline step's args are `[]`.
- `.catch(this.step, ...args)` - those args in place of the token's.
- `.catch(fn)` - a plain function runs as an [inline step](steps.md#inline-steps), given the error then the args. Journaled `then#n`.
- A handler takes the error as `unknown` - `.catch(this.step, ...args)` with a step typed `(error: Error, …)` does not compile.
- A handler throwing - rethrowing included - fails like any step: the next caught token around it takes it, else the run fails. Entries the branch already took back are not taken back twice.
- `this.then.reset()` in a handler restores the branch's fields now - writes after it stand: `this.then.reset(); this.notice = 'retrying';`. Outside a handler it throws `reset() must be called in a .catch handler.`
- The token is journaled with `rescue` - the handler's key, `then` for a function, `true` for none: `{ id: 'scan#1', key: 'scan', args: ['a'], rescue: 'visit' }`.
- Nested catches: the nearest enclosing caught token takes a failure; one in a handler belongs to the branch around it. A second failure in a branch already failing is journaled and absorbed.
- A wait's branch is its answer and the answer's subtree; a watcher throwing is caught there too. A handler opening a wait - `this.then(this.pay)` - asks for another try; put that wait under a caught step to catch the next failure too.

A failure that is expected - no courier, a declined card - is a typed error thrown where it is found and handled where the plan can recover. A handler that does not know it rethrows.

## Retry

```ts
protected async visit(_error: unknown, site: string) {
  this.then.slot({ max: ($) => $.limit, after: this.then.retry && 1000 * 2 ** (this.then.retry - 1) });
  this.scan(site).catch(this.then.retry < 3 ? this.visit : this.skip);
}
```

A step that is also its own handler takes the error first, and its normal calls pass something there - `this.visit(undefined, site)`.

`this.then.retry` counts re-runs - `0` on a step's first run, so `!this.then.retry` means it has not failed:

- a handler that is the issuing step - `.catch(this.visit)` inside `visit` - counts on from the issuer: `visit` at retry 2 schedules a handler at retry 3;
- a handler that is the caught step itself - `this.exec(undefined, call).catch(this.exec)` - is retry 1, given the error in place of its first arg; its own failure is not caught, so it runs once more at most;
- any other handler, and any other step, is `0`.

An entry past 0 carries `retry`. Backoff is a [slot](slot.md) with `after` read from `retry`. A handler re-running its issuer releases the issuer's slots first - it waits `after`, then queues behind other waiters; any other handler under a held slot re-enters it, so `max` is not exceeded and nothing deadlocks. A step waiting on a [pending value](steps.md#pending-values) is not re-run: the wait counts no retry.

## Not caught

- A broken rule - a write after scheduling, lateness, a returned value - fails the run.
- A step that called [`commit()`](undo.md#commit) or made an [irreversible](undo.md#irreversible) change fails the run, journaled with `committed`/`irreversible` and `error`, its writes kept.
- A step rejecting with its own aborted [signal](steps.md#the-step-signal)'s reason is no failure.
- A hook's throw, a compensation's throw, and any failure while the run is stopping or ending.

`slot` and `end` tokens throw `slot() cannot be caught.`; a handler that is not a function throws `catch() takes a step, a function or nothing.` Outside a step, `then.retry` throws `retry must be read inside a step.`
