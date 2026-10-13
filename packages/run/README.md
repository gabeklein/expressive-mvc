# @expressive/run

Durable, resumable runs on Expressive MVC `State` classes. Unreleased -
scope, decisions and status live in [FEATURE.md](../../FEATURE.md) on the
`feat/run` trunk.

```ts
class SubmitOrder extends State {
  run = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  protected new() {
    this.reserve();
  }

  async reserve() {
    await inventory.hold(this.cart.items);
    this.pay();
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);
    this.ship(this.charge.id);
  }

  async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
    this.done();
  }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const order = SubmitOrder.new({ cart });

order.run.status;              // 'running' - reactive, like any field
const receipt = await order.run;
```

- **`run(this)` makes a State a run.** Its methods become steps; each hands
  off to the next and settles. Fields carry data between them and are
  reactive from outside - read for progress, write to steer. `_`-prefixed
  methods are helpers, run inline with the calling step.
- **Nothing awaits a step.** The runtime invokes the next step after the
  current one settles cleanly; a step which throws discards its handoff.
- **The `Runner` is the controller** - `status`, `step`, `entries` (the
  journal), `error`, all reactive; `done()` ends the run; `await` it for the
  result. A `done` method on the class types that result.
- **Inputs are fields**, assigned at `X.new({ ... })` as with any State, so
  they show wherever the run's state does.
