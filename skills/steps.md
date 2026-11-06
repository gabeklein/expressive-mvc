# Steps

`@expressive/steps` - multi-step processes as Models. `class X extends Steps`: every method is a step, a step schedules the next by calling it, fields carry data between steps. Each step is atomic and registers its own undo; a failure unwinds what committed. Runs repeat, queue, and park on waits answered from outside. `0.1`, in-process only - nothing persists across a restart.

```bash
npm install @expressive/steps @expressive/mvc
```

## Shape

```ts
import { Steps } from '@expressive/steps';

class SubmitOrder extends Steps {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  async run() {
    this.reserve();                    // schedule

    await this;                        // the run, to the end

    return { orderId: this.charge!.id, tracking: this.tracking };
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);   // the step's work

    this.pay();                                           // then hand off

    return () => inventory.release(hold);                 // its undo
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));

    return this.refund(this.charge.id);                   // undo as a step
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
const { orderId } = await order;       // runs run(), typed by its return
order.then.status;                     // reactive
```

Inputs are fields (`X.new({ cart })`) or `run`'s arguments. Nothing starts on its own; `new()` stays mvc's setup hook.

## `run` - the entry

- The only step callable from outside: `x.run(args)` starts a run and returns its Promise. While a run is active it queues one, FIFO (`then.queue`); each call settles with its own run.
- `await x` on an idle instance calls `run()` with no arguments - rejects if `run` declares parameters (`run.length`; give an optional one a default). Otherwise it joins: settles with the last queued run.
- Must be `async` (a sync `run` is a type error).
- `await this` inside `run` is its settle point. Before it: field writes and step calls only - awaiting anything else fails the run (`run awaited work before its plan…`). After it, the tail: read fields, return the result or throw. Step calls there throw; writes are unmanaged.
- The run settles with what `run` returns or throws - that types `x.run()` and `await x`. `then.status`/`then.error` record what the plan did, so a tail catching a failure resolves the run while status stays `failed`.
- Without `await this`, `run` settles at once - result `void` (chained style, still valid).
- `return await this` is a TS circularity (TS7023) - return from fields.
- Cleanup on every outcome - done, failed, stopped - is `try`/`catch`/`finally` around `await this`. A run failing before `await this`, or without it, has no tail; that cleanup belongs in the step's undo.
- Inside a step, `this.run(x)` is an ordinary step call - how a loop repeats.

## A step body is a plan

- Calling a step inside a step does not run it: it returns an inert token (not awaitable - `await this.a()` does nothing), scheduled after the caller settles cleanly. A caller that throws schedules nothing.
- Tokens run in issue order, depth-first: each with everything it schedules, before the next sibling.
- **The first call ends the step's work.** After its first token a step may only issue tokens and return. A write after it fails the run; settling more than a few microtasks after the last token fails it too. A sync side effect after scheduling is invisible to the guard - side effects are steps.
- Loops are plain loops, or `this.run(x)` again.

`this.then` inside a step, by argument:

| call | meaning |
| --- | --- |
| `this.then(this.a(x), this.b(y))` | parallel group - members run concurrently, the group completes when all have |
| `this.then(items, this.step)` / `(items, (item) => this.step(item))` | mapped group |
| `this.then(async (signal) => …)` | inline step - a full step journaled `then#n`, not durable |
| `this.then(this.allow, this.deny, watcher?)` | wait - parks until one of those steps is called |
| `this.then.end()` | end the run here - pending discarded; takes no value |
| `this.then.slot({ max, after, key })` | concurrency gate / delay |
| `this.then.back(this.step, reason?)` | unwind what committed after `step`, then continue |
| `this.then.commit()` | point of no return |
| `this.then.signal` | this step's `AbortSignal` - pass it to the call it awaits |

Tokens mixed with functions fail the run. Every token takes `.catch(handler?)`.

## Undo

A step returns nothing, `true`, an undo closure, or a token it issued (`return this.refund(id)` - durable, removed from the plan). Anything else fails the run.

- Every step is atomic: one that throws or is aborted has its own writes restored, fields and `has`/`map` changes alike.
- On failure every committed step unwinds, newest first: its undo runs, then - only if it returned an undo or `true` - its fields are restored. Returning nothing keeps its fields (e.g. a transcript the run is building).
- A returned group runs its members; a returned inline step its function; a returned wait parks the unwind until answered.
- `this.then.commit()` - the step's failure is not caught and the unwind stops at it (`halted`).
- Removing a pool member or destroying a map value the step did not add is irreversible: the unwind stops there and warns.
- `this.then.back(this.reserve, 'no courier')` - unwinds entries after `reserve`'s, then runs what the caller scheduled after it (a retry, or `this.backorder()`); the run continues. Whole-run undo is `stop(true)`.
- Plain arrays/objects mutated in place are invisible - assign, or use `has`/`map`.

## Waits

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed) this.exec(call);
  else
    this.then(this.allow, this.deny, async (signal) => {
      await delay(MINUTE, { signal });
      this.deny(call);                 // watcher answers on timeout
    });
}

async allow(call: ToolCall) { this.exec(call); }
async deny(call: ToolCall) { this.messages.push(denied(call)); }
```

- Status `waiting`; `then.waiting` lists `{ id, step, args, answers }`, reactive.
- Answering steps are public and read `undefined` from outside unless an open wait accepts them - the read tracks, so a view shows a button only while it applies: `agent.allow && <button onClick={() => agent.allow(call)} />`.
- An outside call answers the wait whose opening step's first argument `===` its own, else the oldest. Its Promise resolves when that answer's subtree is done.
- A watcher (plain function) starts when the plan reaches the wait, gets an `AbortSignal`; the first answer closes the wait and aborts every watcher. One settling without answering leaves the wait open.
- Nothing is buffered: an outside call no wait accepts throws.

## Catch and retry

```ts
protected async visit(site: string) {
  this.then.slot({ max: ($) => $.limit, after: this.then.retry && 1000 * 2 ** (this.then.retry - 1) });
  this.scan(site).catch(this.then.retry < 3 ? this.visit : this.skip);
}
```

- A failure in the token's branch (it and its subtree): failing step restored, rest of the branch discarded, its committed entries unwound - then the handler runs in its place and the plan continues.
- `.catch()` skips; `.catch(this.step)` runs that step with the token's args; `.catch((error) => …)` an inline step.
- `this.then.caught` - the error, in the handler. `this.then.retry` - re-run count, `0` on a first run.
- Not caught: rule violations, past `commit()`/irreversible, aborts, failures while stopping or ending.

## Slot

`this.then.slot({ max?, after?, key? })` - a token: waits `after` ms, then queues FIFO for one of `max` slots; what the step schedules after it runs holding the slot.

- `max` - number, or `($) => $.limit` read live through the tracking proxy (a UI can change it mid-run); `0` pauses; omitted = no limit, so `slot({ after })` is a delay.
- `key` - none: the enclosing group's queue; an object (a shared Model): one queue across instances - `max: 1` is a mutex; a primitive: per instance.

## Stop and end

- `then.stop(undo?, reason?)` - cancels: status `stopped`, pending dropped, in-flight steps' signals aborted, the queue rejected; `await this` rejects with an error named `'Stopped'` (`reason` as `cause`). `stop(true)` also unwinds. `set(null)` stops.
- `then.end()` - ends early, keeping everything: in a step at its place in the plan, from outside now. `await this` resolves; the tail builds the result from fields. Why it ended early is data - write a field before calling it. Passing a value throws.
- A failed run nobody awaited rethrows uncaught two microtasks later.

## Hooks

Only `before`, `after` and `back` are hooks (any other name is a step); protected, synchronous, raw instance as `this`, writes unjournaled.

- `before(step, args)` / `after(step, entry)` around every step. `after` gets each committed entry - the Runner keeps no journal, so a log is `this.log.push(entry)`. A try a catch took arrives with `entry.error`; a called `end` arrives too (an implicit one does not).
- `back(reason)` - once after each unwind (a `then.back`, a failure, `stop(true)`).

Entry: `{ id: 'pay#1', key, args, wrote, next, undo?, undone?, wake?, retry?, error?, irreversible?, committed?, halted? }` - no values. The shape is provisional until the durable tier.

## Runner - `this.then`

`status` (`idle | running | waiting | stopped | failed`), `active` (step in flight), `queue`, `waiting`, `runs`, `error` - reactive through the instance (`x.get(($) => $.then.status)`, or in a render), enumerable for a `{ ...x.then }` snapshot; `then.get()` snapshots too. `then` is not in `instance.get()`.

## Conventions

- Steps are `protected async`; `run` and answering steps public. `_`-prefixed methods are helpers, not steps - they run on the instance, unmanaged.
- **Coordination first.** A `Steps` class is the process's template. Each step awaits the one call doing its work, then schedules, groups, gates or catches what follows. Request building, stream handling, parsing, choosing between sources go in functions or in a Model the run owns, finds with `get()`, or reports to.
- Report fields (progress, a status line) are ordinary fields written in steps; the UI subscribes. A failed try restores them - that try did not happen. To keep a value across a failed try write it unmanaged: `this.is.progress = p`, a `_` helper, or an owned Model.
- A class already extending another Model or a `Component` holds a `Steps` model as a field (`pull = new Pull()`), which reaches its owner with `get(Owner)`.
- Effects on `then` wait for the instance to be ready (and a component's host to commit); runs do not.

## Testing

```ts
const order = SubmitOrder.new({ cart });

await expect(order.run()).resolves.toEqual({ orderId: 'ch_42', tracking: 'trk_1' });

vi.spyOn(courier, 'book').mockRejectedValueOnce(new Error('no courier'));
await expect(SubmitOrder.new({ cart }).run()).rejects.toThrow('no courier');
expect(stripe.refund).toHaveBeenCalledWith('ch_42');   // the unwind ran
```

Collect entries for assertions with an `after` hook on a test subclass.
