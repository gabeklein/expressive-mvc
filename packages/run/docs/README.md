# `Job` - Runnable Model

```ts
import { Job } from '@expressive/run';
```

A `Job` is a `Model` whose methods are steps: a step schedules the next by calling it, fields carry data between steps. `next(...args)` is the entry - called from outside, it starts a run; awaiting an idle instance starts it too, only if `next` takes no arguments (an optional one needs a default - [runs.md](runs.md#awaiting-the-instance---start-or-join)). `then` is the controller - status, journal, result - so the instance itself is awaitable, typed by `end`. `Job` declares the contract - `next`, `end`, hooks - as optional members ([job.md](job.md)).

Inputs are fields - `X.new({ cart })` assigns them as any Model's constructor does - or `next`'s arguments. `new()` stays mvc's setup hook; nothing starts on its own.

```ts
class SubmitOrder extends Job {
  static readonly rewind = true;

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  async next() {
    this.reserve();
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.end();

    return this.refund(this.charge.id);
  }

  protected async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  protected end() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const order = SubmitOrder.new({ cart });

order.then.status;                    // 'idle' - reactive
const { orderId } = await order;      // runs next(), typed by end()
```

`Job` is the canonical form. The escape hatch, for a class that cannot extend `Job` - it already extends another `Model` or a `Component` - is `then = run(this)`: the same runtime - steps from the instance's class only, the parent's methods plain; hooks found by name, or passed as options ([job.md](job.md#escape-hatch-runthis-options)).

```ts
class Sync extends Remote {
  then = run(this);

  async next() {
    this.pull();
  }
}
```

Journal after a clean run: `next#1 → reserve#1 → pay#1 → ship#1 ∥ receipt#1 → end#1`. A `courier.book` failure unwinds every committed step: `receipt` (prior restored), `refund('ch_42')`, `inventory.release('hold_sku')`, `next`. Restoring committed fields is `rewind`'s; by default the unwind runs undos and a failing step restores only its own writes ([undo.md](undo.md#rewind)).

- [job.md](job.md) - the contract: members, visibility, when each runs; the `run(this, options)` escape hatch - extension by `base`, hook options
- [steps.md](steps.md) - a step body is a plan: tokens, sequence, groups, inline steps, the step signal, pending values, the first-call rule, calls after a step settles, helpers, `end`, what a step may return
- [runs.md](runs.md) - `next`, repeating, the queue, awaiting, `end` from outside, `stop`, steering
- [wait.md](wait.md) - `this.then(...steps)` parks until one of those steps is called - from outside or by a watcher; answering steps are present only while waited for
- [retry.md](retry.md) - per-step retry with backoff
- [hooks.md](hooks.md) - `before`/`after`, per step or for all; `back(reason)` after an unwind; `exit` on every outcome; hooks as `run()` options
- [undo.md](undo.md) - undo closures, returned tokens - a step, inline step, group or wait - the unwind on failure; `then.back(step)` - the same unwind on command; `rewind`; `commit()`
- [runner.md](runner.md) - the controller: members, reactivity, snapshot

## Conventions

Opinionated, opt-out: steps are `protected async`. Calling a step schedules it and yields no value - `protected` makes the type match the runtime (outside calls throw), `async` makes the declared `Promise<void>` say so uniformly. Neither is enforced.

- Public: `next` - called from outside, its parameters type the call; answering steps (`allow`, `deny`) - called from outside while a wait accepts them. Still `async`.
- `end` is `protected`, `async` only if it awaits - the result type is read from it either way.
- Hooks are `protected` - nothing reads them through the type - and not `async`: their return is not awaited.
