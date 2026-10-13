# Retry - Per Step

`this.then.retry({ attempts, backoff? })` at the top of a step configures that step: on throw, it is invoked again, up to `attempts` tries in total. Before each retry the fields it wrote are restored to its `prior`; with `backoff(attempt)`, the retry waits that many milliseconds (`setTimeout`), `attempt` being the try that failed.

```ts
async ship(chargeId: string) {
  this.then.retry({ attempts: 3, backoff: (attempt) => attempt * 1000 });

  this.tracking = (await courier.book(this.cart, chargeId)).id;
}
```

Each failed try is journaled as its own entry - `{ id, key, args, prior: {}, patch: {}, next: [], attempt, error }` - with the same `id` as the step. The entry that commits carries `attempt` when it is not the first. After the last try fails, the run fails and unwinds as usual.

Only throws from the step body retry: a broken rule - write after scheduling, lateness, a bad return - fails the run at once. Hooks run once around all tries, not per try. A run stopped during a backoff does not try again.

Outside a step, `then.retry()` throws `retry must be called inside a step.`
