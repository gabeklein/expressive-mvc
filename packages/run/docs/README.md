# `run` - Runnable State

```ts
import { State } from '@expressive/mvc';
import { run } from '@expressive/run';
```

`run(this)` makes a `State` a run: every method is a step, a step schedules the next by calling it, fields carry data between steps. The `Runner` it returns is the controller - status, journal, result. Named `then`, the instance itself is awaitable; `run = run(this)` keeps it `await x.run`.

Inputs are fields - `X.new({ cart })` assigns them as any State's constructor does. `new()` is the entry: it schedules the first step.

```ts
class SubmitOrder extends State {
  then = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  protected new() {
    this.reserve();
  }

  async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.ship(this.charge.id);
    this.receipt(this.charge.receiptUrl);
    this.done();

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

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const order = SubmitOrder.new({ cart });

order.then.status;                    // 'running' - reactive
const { orderId } = await order;      // typed by done()
```

Journal after a clean run: `new#1 → reserve#1 → pay#1 → ship#1 → receipt#1 → done#1`. A `courier.book` failure unwinds: `refund('ch_42')`, then `inventory.release('hold_sku')`.

- [steps.md](steps.md) - a step body is a plan: tokens, order, join, the first-call rule, helpers, `done`, what a step may return
- [undo.md](undo.md) - undo closures, returned tokens, the unwind on failure
- [runner.md](runner.md) - the controller: `status`, `step`, `error`, `entries`, reactivity, awaiting, outside calls
