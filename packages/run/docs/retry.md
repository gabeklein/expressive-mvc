# Retry - Per Step

`this.then.retry({ attempts, backoff? })` at the top of a step configures that step: on throw, it is invoked again, up to `attempts` tries in total. Before each retry the fields it wrote are restored to their values before the try; with `backoff(attempt)`, the retry waits that many milliseconds (`setTimeout`), `attempt` being the try that failed.

```ts
protected async ship(chargeId: string) {
  this.then.retry({ attempts: 3, backoff: (attempt) => attempt * 1000 });

  this.tracking = (await courier.book(this.cart, chargeId)).id;
}
```

Each failed try is journaled as its own entry - `{ id, key, args, next: [], wrote: [], attempt, error }` - with the same `id` as the step; `wrote` is empty, its writes being restored. The entry that commits carries `attempt` when it is not the first. After the last try fails, the run fails and unwinds as usual.

Only throws from the step body retry: a broken rule - write after scheduling, lateness, a bad return - fails the run at once. So does an irreversible step ([undo.md](undo.md#irreversible)) - one that removed a pool member or destroyed a map value - and one that called [`then.commit()`](undo.md#commit): its failing try is journaled with `irreversible` or `committed` beside `attempt` and `error`, its writes stay, and the unwind halts there. A step rejecting with its own aborted [signal](steps.md#the-step-signal)'s reason is not retried either.

A step waiting on a [pending value](steps.md#pending-values) is not retrying: the wait uses no attempt.

Before a retry, collections the step changed return to their capture ([undo.md](undo.md#collections)) - a retried step's pushes do not repeat. Hooks run once around all tries, not per try. A run stopped, or ended from outside, during a backoff does not try again.

Outside a step, `then.retry()` throws `retry must be called inside a step.`
