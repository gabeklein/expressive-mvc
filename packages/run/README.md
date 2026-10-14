# @expressive/run

Runs built from Expressive MVC `State` classes: extend `Job` and every method is a step, a step schedules the next by calling it, fields carry data between them. `next()` starts a run; runs repeat, queue, park on a wait - answered from outside or by a watcher - and resume. A run is atomic - all or nothing, with undo closures and an in-memory journal - and the instance is awaitable. Unreleased.

```ts
class SubmitOrder extends Job {
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

order.then.status;             // 'idle' - reactive, like any field
const receipt = await order;   // runs next(), then everything it schedules
```

[docs/](docs/README.md) documents shipped behavior. Scope, decisions and status live in [FEATURE.md](../../FEATURE.md) on the `feat/run` trunk.
