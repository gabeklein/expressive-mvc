# Undo - All or Nothing

A step registers its own undo by what it returns. On failure the run unwinds every committed step in reverse, so a half-done plan leaves nothing behind.

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
- Any answer completes the entry's compensation - `keep` doing nothing included: the unwind continues, restoring the entry's `prior`.
- An answer that throws, or a watcher throwing before an answer, fails the undo as any undo throwing does.
- `stop()` halts the unwind there: the entry gets `halted: true`, it and every entry before it stay applied; status and `error` stay the failure's.

## The unwind

A step that throws, breaks a rule, or returns anything but an undo fails the run:

1. Status `failed`, `error` set; pending steps are discarded, open waits released; the failing step's own writes are restored to its `prior`, unless it is [irreversible](#irreversible).
2. Steps still in flight - parallel members - settle; their commits are recorded.
3. Every committed entry, newest first: its undo runs if it has one (closure, or the returned token - a step with its journaled args, an inline step, a group's members, a wait's answer), then its `prior` values are restored; `undone: true`. Entries without an undo are restored too.
4. An undo that throws: `undone: 'failed'`, `error` replaced by what it threw, the unwind stops there.
5. An `irreversible` entry stops the unwind: it gets `halted: true` ([Collections](#collections)). So does `stop()` while the unwind is parked on a [returned wait](#a-returned-wait).
6. `back(error)` runs, if declared ([hooks.md](hooks.md#back)); a throw from it replaces `error`.
7. The run rejects with `error`.

```ts
vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));

const order = SubmitOrder.new({ cart });

await expect(order.next()).rejects.toThrow('no couriers');

order.then.status;                     // 'failed'
order.charge;                          // undefined - pay's prior restored
order.then.record.map((e) => [e.id, e.undone]);
// [['next#1', true], ['reserve#1', true], ['pay#1', true], ['receipt#1', true]]
```

Here `refund('ch_42')` ran, then `release('hold_sku')`.

Undo frames cannot schedule: a step called from an undo throws (`… is failed; next cannot run.`), which fails that undo. `stop({ undo: true })` unwinds the same way with status `stopped` ([runs.md](runs.md#stop)). Hooks do not run for undos.

## Collections

A `has` list, `has` pool or `map` read by a step through `this` is captured: its contents as of that read, held while the step is in flight. Mutating it in place - `this.messages.push(x)` - is then part of the step:

- The entry gains the field: `prior` and `patch` in export form (`collection.get()`). A read without a change records nothing.
- A change from anywhere while the step is in flight counts - another step's, an outside call's. Parallel steps reading one collection share the earliest capture, and a change is in every such step's entry.
- Rollback, and a retry's restore, return it to the capture: a list is refilled in order; pool members the step added are deleted - destroyed when owned; map keys the step added are deleted, changed or removed ones set back.
- Reads through `this.is` and `_` helpers are not captured.

```ts
async next(prompt: string) {
  this.messages.push(user(prompt));    // prior: { messages: [] }, patch: { messages: [{ role: 'user', … }] }
  this.turn();
}
```

A failing turn leaves `messages` as it was before `next`.

### Irreversible

Some changes cannot be put back: a pool member removed - by `delete`, `clear` or its own destruction - and a map value that was destroyed when removed or replaced (an owned `State`). A step making one without registering an undo is irreversible: its entry carries `irreversible: ['<field>', …]`.

- The unwind stops at the first irreversible entry, newest first. Entries after it are undone; it and every entry before it stay applied, without `undone`; it gets `halted: true`; `error` stays the original failure. `console.warn` names it once: `<instance> stopped unwinding at drop#1: items cannot be restored.`
- A failing step that made one keeps its writes - fields included - and is journaled with `error` and `irreversible`, so the unwind halts there and nothing before it is undone.
- An irreversible step is not retried ([retry.md](retry.md)).
- A step returning an undo - closure or token - is reversible: the unwind runs its undo, then restores what can be restored.

A map restores through its own `set(key, value)`: a factory map (`map((key) => …)`) passes the old value to its factory, so only keys it added are restored exactly.

### Plain arrays and objects

`this.cart.items.push(x)` on a plain array or object is not observable - not journaled, not restored. Assign instead: `this.items = [...this.items, x]` is a field write.

