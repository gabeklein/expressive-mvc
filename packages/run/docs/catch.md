# Catch - Recovery per Branch

A token issued in a step - a step call, a group, an inline step, a wait - takes `.catch(handler?)`. It returns the same token, still one plan item and not awaitable. The token and everything it schedules, transitively, is its branch. When a step in the branch throws, the run does not fail:

1. The failing step's own writes are restored, as always; it is journaled `{ id, key, args, next: [], wrote: [], error }`.
2. The rest of the branch is discarded: pending items dropped, open waits released, slots cancelled, steps in flight aborted - they settle and commit.
3. The branch's committed entries unwind, newest first, as a [`back`](undo.md#back) would: undos run, `prior` restored with [rewind](undo.md#rewind), halting at a `committed` or irreversible entry. Outside the branch nothing is touched - parallel siblings keep their writes.
4. The handler, if any, runs in the branch's place; then the plan continues with the next item, the branch counting as done.

```ts
async next(query: string) {
  this.then(this.sites, this.visit);
  this.report().catch();                         // best effort - skipped on failure
  this.end();
}

protected async visit(site: string) {
  this.then.slot({ max: ($) => $.limit, after: this.then.retry && 1000 * 2 ** (this.then.retry - 1) });
  this.scan(site).catch(this.then.retry < 3 ? this.visit : this.skip);
}

protected async skip(site: string) {
  this.skipped.push(`${site}: ${(this.then.caught as Error).message}`);
}
```

- `.catch()` - the branch is skipped. A group whose members each catch settles with what succeeded.
- `.catch(this.step)` - that step runs with the failed token's args (`scan(site)` → `visit(site)`). A group's or an inline step's args are `[]`.
- `.catch(fn)` - a plain function runs as an [inline step](steps.md#inline-steps), given the error: `.catch((error) => …)`. Journaled `then#n`.
- In the handler, `this.then.caught` is the error; elsewhere `undefined`.
- The token is journaled with `rescue` - the handler's key, `then` for a function, `true` for none: `{ id: 'scan#1', key: 'scan', args: ['a'], rescue: 'visit' }`.
- Nested catches: the nearest enclosing caught token takes a failure; one in a handler belongs to the branch around it. A second failure in a branch already failing is journaled and absorbed.
- A wait's branch is its answer and the answer's subtree; a watcher throwing is caught there too.

## Retry

`this.then.retry` counts re-runs - `0` on a step's first run, so `!this.then.retry` means it has not failed:

- a handler that is the issuing step - `.catch(this.visit)` inside `visit` - counts on from the issuer: `visit` at retry 2 schedules a handler at retry 3;
- a handler that is the caught step itself - `this.scan(x).catch(this.scan)` - is retry 1; its own failure is not caught, so it runs once more at most;
- any other handler, and any other step, is `0`.

An entry past 0 carries `retry`. Backoff is a [slot](slot.md) with `after` read from `retry`. A handler re-running its issuer releases the issuer's slots first - it waits `after`, then queues behind other waiters; any other handler under a held slot re-enters it, so `max` is not exceeded and nothing deadlocks. A step waiting on a [pending value](steps.md#pending-values) is not re-run: the wait counts no retry.

## Not caught

- A broken rule - a write after scheduling, lateness, a bad return - fails the run.
- A step that called [`commit()`](undo.md#commit) or made an [irreversible](undo.md#irreversible) change fails the run, journaled with `committed`/`irreversible` and `error`, its writes kept.
- A step rejecting with its own aborted [signal](steps.md#the-step-signal)'s reason is no failure.
- A hook's throw, an undo's throw, and any failure while the run is stopping or ending.
- A token returned as an undo ignores its catch.

`back`, `slot` and `end` tokens throw `back() cannot be caught.`; a handler that is not a function throws `catch() takes a step, a function or nothing.` Outside a step, `then.retry` and `then.caught` throw - `retry must be read inside a step.`
