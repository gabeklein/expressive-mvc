# Undo - All or Nothing

A step registers its own undo by what it returns. On failure the run unwinds every committed step in reverse, running each undo, so a half-done plan leaves nothing behind that an undo can take back. [`this.then.back(step)`](#back) runs the same unwind on command, over what committed after `step`, and the run goes on.

Every step is atomic: one that throws, is aborted or retried has its own writes restored - fields and [collections](#collections). Once a step settles, its fields stay through an unwind unless the class opts into [rewind](#rewind).

## A closure

Returning a function registers it. It runs with a proxy as `this`, so it reads the fields as the run left them.

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.pay();

  return () => inventory.release(hold);
}
```

Entry: `undo: 'closure'`. Closures do not survive a resume in the job tier; a wait reached while one is held warns ([wait.md](wait.md)).

## A returned token

Returning a token the step issued registers that step as a durable undo `{ id, key, args }` and removes it from the plan - it never runs forward. The token arrives intact from an `async` step.

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.ship(this.charge.id);
  this.end();

  return this.refund(this.charge.id);
}

protected async refund(chargeId: string) {
  await stripe.refund(chargeId);
}
```

Entry: `undo: { id: 'refund#1', key: 'refund', args: ['ch_42'] }`, `next` without it. `end` never registers an undo - its return is the result.

Any token kind works - each is typed `void`, so the step stays `Promise<void>`:

- an inline step - `return this.then(() => stripe.refund(id))` - runs its function, given an `AbortSignal`; not durable ([steps.md](steps.md#inline-steps));
- a group - `return this.then(this.refund(id), this.notify(id))` - runs its members concurrently;
- a wait - see below.

### A returned wait

`return this.then(this.refund, this.keep)` parks the unwind at this entry until one of those steps answers - from outside or a [watcher](wait.md#watchers), which starts when the unwind reaches it:

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);
  this.ship(this.charge.id);

  return this.then(this.refund, this.keep, async (signal) => {
    await delay(DAY, { signal });
    this.refund(this.charge!.id);
  });
}
```

- While parked: status `waiting`, `then.waiting` lists it with the step that returned it, answering steps are present; the run does not reject.
- The answer runs as an undo frame: journaled with `wake`, no hooks, cannot schedule (`… is failed; more cannot run.`). Its call's Promise settles when it completes.
- Any answer completes the entry's compensation - `keep` doing nothing included: the unwind continues, restoring the entry's `prior` with [rewind](#rewind).
- An answer calling [`this.then.commit()`](#commit) declines: the unwind halts at the entry - `halted: true`, its writes kept, nothing before it undone.
- An answer that throws, or a watcher throwing before an answer, fails the undo as any undo throwing does.
- `stop()` halts the unwind there: the entry gets `halted: true`, it and every entry before it stay applied; status and `error` stay the failure's.

## The unwind

A step that throws, breaks a rule, or returns anything but an undo fails the run:

1. Status `failed`, `error` set; pending steps are discarded, open waits released, in-flight steps' [signals](steps.md#the-step-signal) aborted; the failing step's own writes are restored, unless it is [irreversible](#irreversible) or [committed](#commit).
2. Steps still in flight - parallel members - settle; their commits are recorded.
3. Every committed entry, newest first: its undo runs if it has one (closure, or the returned token - a step with its journaled args, an inline step, a group's members, a wait's answer); `undone: true`. With [rewind](#rewind), its `prior` values are then restored and every entry reached is `undone: true`, those without an undo included.
4. An undo that throws: `undone: 'failed'`, `error` replaced by what it threw, the unwind stops there.
5. An `irreversible` or `committed` entry stops the unwind: it gets `halted: true` ([Collections](#collections), [Commit](#commit)). So does `stop()` while the unwind is parked on a [returned wait](#a-returned-wait).
6. `back(error)` runs, if declared ([hooks.md](hooks.md#back)) - `reason` is the error; a throw from it replaces `error`.
7. `exit({ status: 'failed', error })` runs, if declared ([hooks.md](hooks.md#exit)); a throw from it replaces `error`.
8. The run rejects with `error`.

```ts
class Agent extends Job {
  messages = has<Message>();

  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }
}

vi.spyOn(model, 'create').mockRejectedValueOnce(new Error('overloaded'));

await expect(agent.next('write tests')).rejects.toThrow('overloaded');

agent.messages.get(-1);                // { role: 'user', content: 'write tests' } - next's push kept
agent.then.record.map((e) => [e.id, e.undone]);
// [['next#1', undefined]] - no undo to run
```

Steps 3-5 are the unwind [`back`](#back) runs. Entries a `back` already undid are skipped.

Undo frames cannot schedule: a step called from an undo throws (`… is failed; next cannot run.`), which fails that undo. `stop({ undo: true })` unwinds the same way with status `stopped` ([runs.md](runs.md#stop)). Hooks do not run for undos.

## Back

`this.then.back(step, reason?)` inside a step goes back to just after `step`'s latest committed entry and carries on - fail forward, or retry with new input:

```ts
protected async ship(chargeId: string) {
  const booking = await courier.book(this.cart, chargeId);

  if (booking) {
    this.tracking = booking.id;
    return this.then(() => courier.cancel(booking.id));
  }

  this.then.back(this.reserve, 'no courier');   // pay refunded, receipt dropped, the hold stays
  this.backorder();                             // runs after the unwind
}
```

It is a token in the plan, like a step call. When the plan reaches it:

1. Pending items scheduled by entries committed after `step`'s - transitively - are discarded; their open waits released; in-flight ones aborted, then unwound once they settle and commit.
2. Those entries unwind, newest first, as on failure: undos run, `prior` restored with [rewind](#rewind) (left as they are by default), `undone` marked. `step`'s entry stays. An irreversible or committed entry halts it there - `halted: true` - and the run still continues.
3. The entry `{ id: 'back#1', key: 'back', args: [], next: [], wrote: [], to: 'reserve#1', reason: 'no courier' }` is journaled - `to` the entry kept, `reason` when given. Discarded items are not journaled.
4. `back(reason)` runs ([hooks.md](hooks.md#back)).
5. What the calling step scheduled after `back()` runs; nothing else, and the plan drains to `end`, or the values dump. The run does not fail.

- The calling step has not committed when it calls `back` - its own writes stay, and it is never a target: `this.then.back(this.ship)` from `ship` targets an earlier `ship`. Steps it scheduled before `back()` have run by then and are unwound.
- Retry is a call after it - `this.then.back(this.reserve); this.pay(card2);` - or a wait for one: `this.then.back(this.reserve); this.then(this.pay);` parks until `order.pay(card2)` from outside.
- `end` scheduled by an unwound entry is discarded; one scheduled after `back()` replaces it.
- `step` is a step reference. A call, string or nothing throws `back() takes a step to go back to; stop({ undo: true }) unwinds the whole run.`; `step` without a committed entry fails the run - `back() found no committed reserve.`
- An undo throwing fails the run, `undone: 'failed'`; the failure unwind stops there. A throw from `back` fails the run.
- Backs from parallel steps run one at a time. `stop()`, a failure or an outside `end` during one stops it; a failure's unwind takes up what is left.
- Not groupable (`back() cannot be grouped.`), not an undo - returned, it fails the run as any value.

## Rewind

`static readonly rewind = true` on a `Job` - `run(this, { rewind: true })` on the escape hatch - makes the unwind restore settled steps' fields too: all or nothing, as far as the unwind gets.

```ts
class SubmitOrder extends Job {
  static readonly rewind = true;
  // ...
}

vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));

await expect(order.next()).rejects.toThrow('no couriers');

order.charge;                          // undefined - pay's prior restored
order.then.record.map((e) => [e.id, e.undone]);
// [['next#1', true], ['reserve#1', true], ['pay#1', true], ['receipt#1', true]]
```

Here `refund('ch_42')` ran, then `release('hold_sku')`.

| | default | `rewind` |
| --- | --- | --- |
| entry | `wrote: ['charge']` | `wrote`, plus `prior` / `patch` values ([runner.md](runner.md#entry)) |
| failing, aborted or retried step | own writes restored | same |
| settled step on unwind | undo runs; fields stay | undo runs, then `prior` restored |
| `undone: true` | entries whose undo ran | every entry reached |

The default holds no values past a step's commit - for a long-lived instance whose fields are the product, such as a transcript. Rewind holds every entry's `prior`/`patch` for the run.

## Commit

`this.then.commit()` inside a step is a deliberate point of no return - a charge captured, a message sent. Once it is called, the step is treated as [irreversible](#irreversible):

- it is not retried;
- if it throws after `commit()`, its own writes stay; its failing try is journaled with `committed: true` and `error`;
- the unwind stops at its entry - `halted: true` - without running its undo or anything before it. No warning: the stop is deliberate.

```ts
protected async pay() {
  this.charge = await stripe.capture(this.intent);
  this.then.commit();

  this.ship(this.charge.id);
}
```

Entry: `committed: true`. Outside a step, `then.commit()` throws `commit must be called inside a step.`; through a settled step's proxy, `pay has settled; commit cannot run.`

## Collections

A `has` list, `has` pool or `map` read by a step through `this` is captured: its contents as of that read, held while the step is in flight. Mutating it in place - `this.messages.push(x)` - is then part of the step:

- The entry's `wrote` lists the field; with [rewind](#rewind), `prior` and `patch` hold it in export form (`collection.get()`). A read without a change records nothing.
- A change from anywhere while the step is in flight counts - another step's, an outside call's. Parallel steps reading one collection share the earliest capture, and a change is in every such step's entry.
- Restoring - a failing, aborted or retried step, or a committed one under [rewind](#rewind) - returns it to the capture: a list is refilled in order; pool members the step added are deleted - destroyed when owned; map keys the step added are deleted, changed or removed ones set back.
- Reads through `this.is` and `_` helpers are not captured.

```ts
async next(prompt: string) {
  this.messages.push(user(prompt));    // wrote: ['messages']
  this.turn();
}
```

A turn failing mid-step loses its own pushes; with rewind, a failing run leaves `messages` as it was before `next`.

### Irreversible

Some changes cannot be put back: a pool member removed - by `delete`, `clear` or its own destruction - and a map value that was destroyed when removed or replaced (an owned `State`). A step making one without registering an undo is irreversible: its entry carries `irreversible: ['<field>', …]`. Detected in both modes - it governs retry and where the unwind stops.

- The unwind stops at the first irreversible entry, newest first. Entries after it are undone; it and every entry before it stay applied, without `undone`; it gets `halted: true`; `error` stays the original failure. `console.warn` names it once: `<instance> stopped unwinding at drop#1: items cannot be restored.`
- A failing step that made one keeps its writes - fields included - and is journaled with `error` and `irreversible`, so the unwind halts there and nothing before it is undone.
- An irreversible step is not retried ([retry.md](retry.md)).
- A step returning an undo - closure or token - is reversible: the unwind runs its undo, then restores what can be restored.

A map restores through its own `set(key, value)`: a factory map (`map((key) => …)`) passes the old value to its factory, so only keys it added are restored exactly.

### Plain arrays and objects

`this.cart.items.push(x)` on a plain array or object is not observable - not journaled, not restored. Assign instead: `this.items = [...this.items, x]` is a field write.

