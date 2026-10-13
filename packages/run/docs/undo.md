# Undo - All or Nothing

A step registers its own undo by what it returns. On failure the run unwinds every registered undo in reverse, so a half-done plan leaves nothing behind.

## A closure

Returning a function registers it. It runs with the frame proxy as `this`, so it reads the fields as the step left them.

```ts
async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.pay();

  return () => inventory.release(hold);
}
```

Entry: `undo: 'closure'`.

## A returned token

Returning a token registers that step as a durable undo `{ key, args }` and removes it from the plan - it never runs forward.

```ts
async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.ship(this.charge.id);
  this.done();

  return this.refund(this.charge.id);
}

async refund(chargeId: string) {
  await stripe.refund(chargeId);
}
```

Entry: `undo: { id: 'refund#1', key: 'refund', args: ['ch_42'], after: [] }`, `next` without it. A token awaited and then returned fails the run - nothing can depend on a step that will not run (`second waits on release#1, which was returned as an undo.`).

`done` never registers an undo - its return is the result.

## The unwind

A step that throws, or returns anything but an undo, fails the run:

1. status `failed`, `error` set, `step` cleared; the pending plan is discarded - what the failing step scheduled never runs.
2. Entries with an undo, in reverse commit order: the undo runs (closure with the frame proxy as `this`, or the undo step with its journaled args); that entry's `prior` values are restored; `undone: true`.
3. An undo that throws: `undone: 'failed'`, `error` replaced by what it threw, the unwind stops there.
4. The result rejects with `error`.

```ts
vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));

const order = SubmitOrder.new({ cart });

await expect(order).rejects.toThrow('no couriers');

order.then.status;                     // 'failed'
order.charge;                          // undefined - pay's prior restored
order.then.entries.map((e) => [e.id, e.undone]);
// [['new#1', undefined], ['reserve#1', true], ['pay#1', true]]
```

Here `refund('ch_42')` ran, then `release('hold_sku')`.

An entry without an undo is skipped - its patch stays. The failing step itself never committed: its writes are on the instance and in no entry. A step whose writes must not survive failure returns an undo, even an empty one.

Undo frames may not schedule: a step called from an undo throws (`… is failed; first cannot run.`), which fails that undo.

## Unawaited failures

A failed run nobody awaited rethrows uncaught two microtasks after rejecting. `await` it, or `.then` it, before then - or let it surface.
