# `run` - Runnable State

```ts
import { State } from '@expressive/mvc';
import { run } from '@expressive/run';
```

`run(this)` makes a `State` runnable: every method is a step, a step schedules the next by calling it, fields carry data between steps. `next(...args)` is the entry - called from outside, it starts a run. The `Runner` it returns is the controller - status, journal, result. Named `then`, the instance itself is awaitable; `run = run(this)` keeps it `await x.run`.

Inputs are fields - `X.new({ cart })` assigns them as any State's constructor does - or `next`'s arguments. `new()` stays mvc's setup hook; nothing starts on its own.

```ts
class SubmitOrder extends State {
  then = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  next() {
    this.reserve();
  }

  async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then([this.ship(this.charge.id), this.receipt(this.charge.receiptUrl)]);
    this.end();

    return this.refund(this.charge.id);
  }

  async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  end() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const order = SubmitOrder.new({ cart });

order.then.status;                    // 'idle' - reactive
const { orderId } = await order;      // runs next(), typed by end()
```

Journal after a clean run: `next#1 → reserve#1 → pay#1 → ship#1 ∥ receipt#1 → end#1`. A `courier.book` failure unwinds every committed step: `receipt` (prior restored), `refund('ch_42')`, `inventory.release('hold_sku')`, `next`.

- [steps.md](steps.md) - a step body is a plan: tokens, sequence, groups, the first-call rule, helpers, `end`, what a step may return
- [runs.md](runs.md) - `next`, repeating, the queue, awaiting, `stop`
- [wait.md](wait.md) - parking a branch until an outside call answers it
- [retry.md](retry.md) - per-step retry with backoff
- [hooks.md](hooks.md) - `before`/`after`, per step or for all
- [undo.md](undo.md) - undo closures, returned tokens, the unwind on failure
- [runner.md](runner.md) - the controller: members, reactivity, snapshot
