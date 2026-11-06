# `Steps` - Runnable Model

```ts
import { Steps } from '@expressive/steps';
```

`Steps` is a `Model` base whose subclasses' methods are steps: a step schedules the next by calling it, fields carry data between steps. `run(...args)` is the entry - called from outside, it starts a run; awaiting an idle instance starts it too, only if `run` takes no arguments (an optional one needs a default - [runs.md](runs.md#awaiting-the-instance---start-or-join)). `run` takes arguments, schedules, `await this` for the run, and returns the result - typing `x.run()` and `await x`. `then` is the controller - status, queue, waits - so the instance itself is awaitable. `Steps` declares the contract - `run`, hooks - as optional members ([contract.md](contract.md)).

Inputs are fields - `X.new({ cart })` assigns them as any Model's constructor does - or `run`'s arguments. `new()` stays mvc's setup hook; nothing starts on its own.

```ts
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

    this.pay();

    return () => inventory.release(hold);
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.then.end();

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
}

const order = SubmitOrder.new({ cart });

order.then.status;                    // 'idle' - reactive
const { orderId } = await order;      // runs run(), typed by its return
```

A class that cannot extend `Steps` - it already extends another `Model` or a `Component` - holds a `Steps` subclass as a field: `pull = new Pull()`, which reaches its owner with `get()` ([contract.md](contract.md#composition)).

## Coordination first

Opinionated, opt-out: a `Steps` class is the process's template, not where its work lives. A step awaits the call that does its work, then schedules, groups, gates or catches what follows. Work with its own state or more than a few lines - building a request, streaming a response, parsing, choosing between sources - goes in a function, or a Model the run owns (a field), finds (`get()` - a peer or its owner) or reports to. Read top to bottom, the steps are the recipe.

```ts
protected async sample(body: RenderBody) {
  const image = await this.engine.render(body, this.then.signal);

  this.save(image);
}
```

Reporting state - progress, a status line - is ordinary fields, written in the steps; the UI reads them in a subscribed render or a `get()` effect. A failed or re-run try restores what it wrote - that try did not happen - and the catch handler or the next step writes fresh values. A value that must outlive a failed try lives on an owned Model.

Entries of a clean run: `run#1 → reserve#1 → pay#1 → ship#1 ∥ receipt#1`, then `end`. A `courier.book` failure unwinds every committed step, newest first: `refund('ch_42')`, then `charge` restored - `pay` returned an undo - then `inventory.release('hold_sku')`. A step that returns nothing keeps its fields through an unwind; one that returns an undo or `true` has them restored ([undo.md](undo.md#restoring-fields)).

- [contract.md](contract.md) - the contract: members, visibility, when each runs; composition - a `Steps` model held as a field
- [steps.md](steps.md) - a step body is a plan: tokens, sequence, groups, inline steps, the step signal, pending values, the first-call rule, calls after a step settles, helpers, `end`, what a step may return
- [runs.md](runs.md) - `run`, repeating, the queue, awaiting, `end` from outside, `stop`, steering
- [wait.md](wait.md) - `this.then(...steps)` parks until one of those steps is called - from outside or by a watcher; answering steps are present only while waited for
- [slot.md](slot.md) - `this.then.slot({ max, after, key })`: concurrency per group, instance or shared key; a delay
- [catch.md](catch.md) - `.catch(handler?)` on a token: a failing branch unwinds and the run continues - skipped, or a step in its place; `this.then.retry` counts re-runs
- [hooks.md](hooks.md) - `before`/`after` around every step; `back(reason)` after an unwind; cleanup in `run`'s tail
- [undo.md](undo.md) - undo closures, returned tokens - a step, inline step, group or wait - the unwind on failure; `then.back(step)` - the same unwind on command; restoring fields by return; `commit()`
- [runner.md](runner.md) - the controller: members, reactivity, snapshot

## Conventions

Opinionated, opt-out: steps are `protected async`. Calling a step schedules it and yields no value - `protected` makes the type match the runtime (outside calls throw), `async` makes the declared `Promise<void>` say so uniformly. Neither is enforced.

- Public: `run` - called from outside, its parameters type the call; answering steps (`allow`, `deny`) - called from outside while a wait accepts them. Still `async`.
- `run` is `async` when it awaits its run; its return types the result.
- Hooks are `protected` - nothing reads them through the type - and not `async`: their return is not awaited.
- `_` helpers are `private` - not steps, called only from the class's own steps - and sync when they compute.
