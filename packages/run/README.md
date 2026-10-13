# @expressive/run

Durable, resumable runs on Expressive MVC `State` classes. Unreleased -
scope, decisions and status live in [FEATURE.md](../../FEATURE.md) on the
`feat/run` trunk.

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

- **`run(this)` makes a State a run.** Every method is a step, `_`-prefixed
  ones are helpers (inline, unwrapped). Steps are wrapped as own
  non-enumerable properties of the instance - the prototype is untouched.
  `new()` is the entry point. The field name is the user's; `then` makes
  the instance itself awaitable, `run = run(this)` keeps it `await x.run`.
- **A step body is a plan builder.** Calling a step from inside a step does
  not run it: it returns an inert token, scheduled after the caller settles
  cleanly. Tokens issued together fork, run serially in issue order.
  `await this.a()` resolves at once and records order only - a token
  depends on every token awaited before it was issued, so
  `await Promise.all([this.a(), this.b()])` joins. Loops are plain loops.
- **The first step call ends the step's work.** After it, a step may only
  schedule, await tokens, and return. A write through `this` after
  scheduling fails the run; so does settling more than a few microtasks
  after the last token event. A sync side effect after scheduling is not
  detectable - side effects are steps.
- **Returns.** A step returns nothing, a closure (its undo), or a token
  (`return this.release(id)` - removed from the plan, journaled as a
  durable undo `{ key, args }`). Anything else fails the run. `done`'s
  return is the result.
- **`done` joins.** It runs once nothing else is pending. A class `done`
  is a step that types the result (its return, else its argument);
  `this.then.done(value?)` is the controller form - undeclared `done`, or
  an early end. A plan that drains without `done` ends with a dump of
  public values, the `Runner` excluded.
- **Each step runs with a proxy as `this`.** Writes through it are the
  entry's `patch`, with `prior` values; a token is attributed to the frame
  whose proxy issued it. `this.is` and outside writes are steers, not
  journaled.
- **Failure unwinds.** Status `failed`, pending plan discarded, entries
  undone in reverse commit order - run the undo (closure with the frame
  proxy as `this`, or the undo step), restore `prior`, mark `undone`. An
  undo that throws marks `undone: 'failed'`, replaces `error`, stops the
  unwind. The result rejects; unawaited, it rethrows uncaught two
  microtasks later.
- **The `Runner` is the controller** - an observable callable, not a
  State: `status`, `step`, `error`, `entries` are reactive; `on` is the
  instance; `get()` is the record; `await` it for the result. Named
  `then`, the instance resolves the same way - `Promise.resolve(order)`
  and a `set(async () => SubmitOrder.new())` factory yield the result. A
  tracking read of `then` (render, `get()` effect) is an observable view,
  not callable - `await` the instance outside tracking contexts. Outside
  calls: a step while one runs throws; any step after done or failed
  throws.
- **Inputs are fields**, assigned at `X.new({ ... })` as with any State, so
  they show wherever the run's state does.
