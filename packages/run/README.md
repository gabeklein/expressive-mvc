# @expressive/run

Durable, resumable runs built from Expressive MVC `State` classes. Unreleased -
scope, decisions and status live in [FEATURE.md](FEATURE.md).

```ts
class SubmitOrder extends Runner {
  cart: Cart;
  charge?: Charge = undefined;
  tracking = "";

  protected new() {
    this.reserve();
  }

  async reserve() {
    await inventory.hold(this.cart.items);
    this.pay();
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);
    this.all([this.ship(this.charge.id), this.receipt()], this.done);
  }

  async ship(chargeId: string) { this.tracking = (await courier.book(this.cart, chargeId)).id; }
  async receipt() { await mail.send(this.cart.email, this.charge!.receiptUrl); }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const result = await SubmitOrder.new({ cart });
```

- **A `Runner` is one run.** Its methods are steps; each hands off to the next
  and settles. Fields carry data between them and are reactive from outside -
  read for progress, write to steer.
- **Nothing awaits a step.** The runtime invokes the next step after the
  current one settles cleanly; a step which throws discards its handoff.
- **Inputs are fields**, assigned at `X.new({ ... })` as with any State - so they
  show wherever the run's state does.
- **`done` ends the run** and types its result. `await X.new({ ... })` resolves to
  it; `X.new({ ... })` alone is the live instance.
- **Runs are records** - constructor args plus a journal of steps - so an
  instance can be rebuilt mid-run: resume, retry, fork to debug.
