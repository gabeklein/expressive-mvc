# @expressive/run

Runs built from Expressive MVC `State` classes: every method is a step, a step schedules the next by calling it, fields carry data between them. A run is atomic - all or nothing, with undo closures and an in-memory journal - and the instance is awaitable. Unreleased.

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

order.then.status;             // 'running' - reactive, like any field
const receipt = await order;
```

[docs/](docs/README.md) documents shipped behavior. Scope, decisions and status live in [FEATURE.md](../../FEATURE.md) on the `feat/run` trunk.
