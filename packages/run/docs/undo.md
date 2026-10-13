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

## The unwind

A step that throws, breaks a rule, or returns anything but an undo fails the run:

1. Status `failed`, `error` set; pending steps are discarded, open waits released; the failing step's own writes are restored to its `prior`.
2. Steps still in flight - parallel members - settle; their commits are recorded.
3. Every committed entry, newest first: its undo runs if it has one (closure, or the undo step with its journaled args), then its `prior` values are restored; `undone: true`. Entries without an undo are restored too.
4. An undo that throws: `undone: 'failed'`, `error` replaced by what it threw, the unwind stops there.
5. The run rejects with `error`.

```ts
vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));

const order = SubmitOrder.new({ cart });

await expect(order.next()).rejects.toThrow('no couriers');

order.then.status;                     // 'failed'
order.charge;                          // undefined - pay's prior restored
order.then.record.map((e) => [e.id, e.undone]);
// [['next#1', true], ['reserve#1', true], ['pay#1', true], ['receipt#1', true]]
```

Here `refund('ch_42')` ran, then `release('hold_sku')`. Writes to `has`/`map` collections (`push`, `set`) are not field writes - no `prior`, not restored.

Undo frames cannot schedule: a step called from an undo throws (`… is failed; next cannot run.`), which fails that undo. `stop({ undo: true })` unwinds the same way with status `stopped` ([runs.md](runs.md#stop)). Hooks do not run for undos.
