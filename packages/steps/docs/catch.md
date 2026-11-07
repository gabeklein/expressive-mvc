# Catch - Recovery per Branch

A token issued in a step - a step call, a group, an inline step, a wait - takes `.catch(handler?)`; a plan from `this.then(...)` - a `Steps.Plan` - also takes steps called for it. It returns the same token, still one plan item and not awaitable. The token and everything it schedules, transitively, is its branch. When a step in the branch throws, the run does not fail:

1. The failing step's own writes are restored, as always; it is journaled `{ id, key, args, next: [], wrote: [], error }`.
2. The rest of the branch is discarded: pending items dropped, open waits released, slots cancelled, steps in flight aborted - they settle and commit.
3. The branch unwinds as a failed run would ([undo.md](undo.md#the-unwind)): undos newest first, halting at a `committed` or irreversible entry. Outside the branch nothing is touched - parallel siblings keep their writes.
4. The handler, if any, runs in the branch's place, seeing the branch's state as it failed. Once its body returns, the branch's fields are restored - except keys it wrote - before what it scheduled runs. The plan then continues with the next item, the branch counting as done.

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.then.undo(this.release(hold));
  this.pay().catch(this.noCourier);
}

protected async noCourier(error: unknown) {
  if (!(error instanceof NoCourier)) throw error;

  this.notice = 'backordered';
  this.backorder();
}
```

- `.catch()` - the branch is skipped. A group whose members each catch settles with what succeeded.
- A handler's steps keep their own signatures and run in the branch's place.
- A handler throwing - rethrowing included - fails like any step: the next caught token around it takes it, else the run fails. Entries the branch already took back are not taken back twice.
- `this.then.reset()` in a handler restores the branch's fields now - writes after it stand: `this.then.reset(); this.notice = 'retrying';`. Outside a handler it throws `reset() must be called in a .catch handler.`
- The token is journaled with `rescue` - steps called for it, a step method's key, `then` for a function, `true` for none: `{ id: 'then#1', key: 'then', args: [], group: [scan], rescue: [{ id: 'visit#2', key: 'visit', args: ['a'] }] }`.
- Nested catches: the nearest enclosing caught token takes a failure; one in a handler belongs to the branch around it. A second failure in a branch already failing is journaled and absorbed.
- A wait's branch is its answer and the answer's subtree; a watcher throwing is caught there too. A handler opening a wait - `this.then(this.pay)` - asks for another try; put that wait under a caught step to catch the next failure too.

Order of an unwind: a step fails → undos run, newest first, back to the nearest `.catch` whose branch holds the failure → that catch's handler runs in the branch's place → no catch, and the run fails after undoing the rest.

A failure that is expected - no courier, a declined card - is a typed error thrown where it is found and handled where the plan can recover. A handler that does not know it rethrows.

## Handlers

Step references are recorded; functions belong to the process.

| handler | runs on failure | recorded |
| --- | --- | --- |
| `this.then(this.scan(site)).catch(this.visit(site))` - steps called for a plan's `catch`, several a group | the steps, with their args | the steps and args |
| `.catch(this.noCourier)` - a step method | the step, given the error alone | its key; its entry's args hold the error as `{ name, message, cause }` |
| `.catch((error) => { … })` - a function | given the error, as `Promise.catch` - an [inline step](steps.md#inline-steps) whose step calls schedule | `then` - process-local |

- Steps called for a catch are claimed, not scheduled; a step call's own `catch` is `Promise.catch`-typed, so wrap it: `this.then(this.scan(site))`. This is how a recorded handler gets args.
- A step method runs given the error, whatever it declares. In process it gets the original; the durable tier will rebuild it from the record - `'Stopped'` included.
- A function is dropped on restart: the failure then has no handler there, and the run fails instead of recovering. Use it where losing the branch is acceptable, or for what only this process can do.

## Retry

```ts
protected async visit(site: string) {
  this.then.slot({ max: ($) => $.limit, after: this.then.retry && 1000 * 2 ** (this.then.retry - 1) });

  const scan = this.then(this.scan(site));

  if (this.then.retry < 3) scan.catch(this.visit(site));
  else scan.catch((error) => { this.skip(site, error); });
}
```

`this.then.retry` counts re-runs - `0` on a step's first run, so `!this.then.retry` means it has not failed. Read it in the step; inside a function handler `this.then` is the handler's. A step a handler runs counts:

- the issuing step again - `visit` inside `visit`'s catch - one past the issuer: `visit` at retry 2 schedules one at retry 3;
- the caught step again - `this.then(this.exec(call)).catch(this.exec(call))` - retry 1; its own failure is not caught, so it runs once more at most;
- any other step `0`.

An entry past 0 carries `retry`. Backoff is a [slot](slot.md) with `after` read from `retry`. A handler re-running its issuer releases the issuer's slots first - it waits `after`, then queues behind other waiters; any other handler under a held slot re-enters it, so `max` is not exceeded and nothing deadlocks. A step waiting on a [pending value](steps.md#pending-values) is not re-run: the wait counts no retry.

## Not caught

- A broken rule - a write after scheduling, lateness, a returned value - fails the run.
- A step that called [`commit()`](undo.md#commit) or made an [irreversible](undo.md#irreversible) change fails the run, journaled with `committed`/`irreversible` and `error`, its writes kept.
- A step rejecting with its own aborted [signal](steps.md#the-step-signal)'s reason is no failure.
- A hook's throw, an undo's throw, and any failure while the run is stopping or ending.

`slot` and `end` tokens throw `slot() cannot be caught.`; anything else throws `catch() takes a step, a function, steps called for it or nothing.` Outside a step, `then.retry` throws `retry must be read inside a step.`
