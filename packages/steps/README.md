# @expressive/steps

Multi-step processes as Expressive Models. Extend `Steps` and every method is a step: a step schedules the next by calling it, fields carry data between them. `run()` takes the arguments, schedules, waits for the run with `await this`, and returns the result. Each step is atomic and registers its own undo, so a failure unwinds what committed. Runs repeat, queue and park on waits answered from outside; status is reactive on `this.then`.

In-process only for now - no durable persistence.

```bash
npm install @expressive/steps @expressive/mvc
```

```ts
import { Steps } from '@expressive/steps';

class SubmitOrder extends Steps {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  async run() {
    this.reserve();

    await this;

    return { orderId: this.charge!.id, tracking: this.tracking };
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.then.undo(this.release(hold));
    this.pay();
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);
    this.then.undo(this.refund(this.charge.id));

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
  }

  protected async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async release(hold: string) {
    await inventory.release(hold);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }
}

const order = SubmitOrder.new({ cart });

order.then.status;                     // 'idle' - reactive, like any field
const { orderId } = await order;       // runs run(), typed by its return
```

A failed `courier.book` unwinds newest first: `refund`, then `release`, then every taken-back step's fields restored.

Reference: [docs/](docs/README.md), and the `steps` page of the Expressive skill ([skills/steps.md](../../skills/steps.md)).
