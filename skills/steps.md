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

    this.then.on({ reset: () => inventory.release(hold) });                 // right after the effect - runs only when taken back
    this.pay().catch(this.noCourier);                     // then hand off
  }

  protected async noCourier(error: unknown) {             // pay's branch failed and was unwound
    if (!(error instanceof NoCourier)) throw error;
    this.backorder();
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);
    this.then.on({ reset: () => stripe.refund(this.charge!.id) });

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
  }

  protected async ship(chargeId: string) {
    const booking = await courier.book(this.cart, chargeId);

    if (!booking) throw new NoCourier();
    this.tracking = booking.id;
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async backorder() {
    await mail.send(this.cart.email, backorderUrl(this.cart));
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
- Without `await this`, `run` settles at once - result `void` (chained style).
- `return await this` is a TS circularity (TS7023) - return from fields.
- Cleanup on every outcome - done, failed, stopped - is `try`/`catch`/`finally` around `await this`. A run failing before `await this`, or without it, has no tail; that cleanup belongs in a step's undo.
- `run` is entry only - inside a step `this.run()` throws; a loop is a step scheduling itself.

## A step body is a plan

- Calling a step inside a step does not run it: it returns an inert token (not awaitable - `await this.a()` does nothing), scheduled after the caller settles cleanly. A caller that throws schedules nothing.
- Tokens run in issue order, depth-first: each with everything it schedules, before the next sibling.
- **The first call ends the step's work.** After its first token a step may only issue tokens and return. A write after it fails the run; settling more than a few microtasks after the last token fails it too. A sync side effect after scheduling is invisible to the guard - side effects are steps.
- Loops are plain loops, or a step scheduling itself.

`this.then` inside a step, by argument:

| call | meaning |
| --- | --- |
| `this.then(this.a(x), this.b(y))` | parallel group - members run concurrently, the group completes when all have |
| `this.then(items, this.step)` / `(items, (item) => this.step(item))` | mapped group |
| `this.then(this.allow, this.deny, this.timeout(x)?)` | wait - parks until one of those steps is called; called steps race it |
| `this.then({ min: 1 })` | duration - parks for `ms`/`sec`/`min`/`hr`/`day`, summed |
| `this.then.only(2)` / `.only(1, lock)` | gate - only so many at once |
| `this.then.end()` | end the run here - pending discarded; takes no value |
| `this.then.on({ reset: () => release(hold) })` | handlers for this step's subtree - `reset`, `catch`, `close` |
| `this.then.commit()` | point of no return |
| `this.then.signal` | this step's `AbortSignal` - pass it to the call it awaits |

A plain function fails the run - work is a step. Every token takes `.catch(handler?)`.

## Outcomes - `then.on`

A step returns nothing - a value fails the run. `this.then.on({ … })` registers handlers for the step and everything it schedules (its subtree) - right after the effect, usually just above scheduling. A handler is an arrow, writing through the step's `this` - one line an expression, more an async arrow with `await`.

```ts
this.then.on({
  reset: () => stripe.refund(chargeId),      // the step is taken back - reset its effect
  catch: (error) => {                        // a failure below - return recovers, throw passes on
    if (!(error instanceof Busy)) throw error;
    this.later();
  },
  close: async (reason) => {                 // a finally over the subtree, given why
    this.preview.close();
    if (reason instanceof Steps.Aborted) await Image.delete(this.name);
  }
});
```

| key | fires (deepest step first, newest first) | function gets |
| --- | --- | --- |
| `reset` | the step is taken back - a failure leaving the subtree, `abort()`, a lost race | nothing |
| `catch` | a step below failed, no `.catch` closer took it - return recovers, throw passes on | the error |
| `close` | subtree ended any way, last; alone on a clean finish | `undefined` if clean (recovered or `then.end()` too), else the error, a `Steps.Aborted` (abort, lost race) or a `Steps.Stopped` (stop) |

- `reset` takes back the step's effects; `this.then.restore()` puts a caught branch's fields back now.
- To observe a failure, an abort or a stop, read `reason` in `close`; `catch` is for recovery. `stop()` resets nothing.
- `catch` returning recovers at its step: the failed part of the subtree unwinds, the step's effects stay, its `reset` does not run; steps it schedules replace the rest. It covers from registration on, the rest of the step's own body included (a throw there resets the step first); one per step; it runs before a `.catch` on the step's call (inner first); `this.then.retry()` replays the step. A step finished earlier and taken back by a later failure gets `reset` and no `close`.
- Every step is atomic: one that throws or is aborted has its own writes restored, fields and `has`/`map` changes alike.
- Unwind order: failure → handlers newest first back to the nearest catch holding it → that catch's handler → no catch, the run fails. Then the fields of every step taken back are restored; `run`'s never are.
- Registered before its step fails, handlers run for that failure too and see the step's partial writes. They run before fields are restored; keys they write are kept. An unknown key throws. `run` registers none - clean up in its tail.
- Durable runs (future): a handler whose external effect must survive a restart is a step called for it - `{ reset: this.release(hold) }`, an array a group - claimed, not scheduled, recorded with its args, reaching `before`/`after`; one called for `catch` or `close` reads the error or reason from `this.then.error`. `end`, gates and waits throw in handlers.
- `this.then.commit()` - the step's failure is not caught and the unwind stops at it (`halted`): what came before stands - e.g. a transcript the run is building.
- Removing a pool member or destroying a map value the step did not add is irreversible: the unwind stops there and warns.
- Whole-run undo is `abort()`; partial is a [catch](#catch-and-retry).
- Plain arrays/objects mutated in place are invisible - assign, or use `has`/`map`.

## Waits

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed) this.exec(call);
  else this.then(this.allow, this.deny, this.timeout(call));
}

protected async timeout(call: ToolCall) {   // a racer - starts with the wait
  this.then({ min: 1 });
  this.deny(call);                          // answers the wait it races
}

async allow(call: ToolCall) { this.exec(call); }
async deny(call: ToolCall) { this.messages.push(denied(call)); }
```

- Status `waiting`; `then.waiting` lists `{ id, step, args, answers, until? }`, reactive - durations included.
- Answering steps are public and read `undefined` from outside unless an open wait accepts them - the read tracks, so a view shows a button only while it applies: `agent.allow && <button onClick={() => agent.allow(call)} />`.
- An outside call answers the wait whose opening step's first argument `===` its own, else the oldest. Its Promise resolves when that answer's subtree is done.
- A step called beside the answers is a racer: claimed, started when the plan reaches the wait. Inside it, a call to an answer answers that wait. The first answer closes the wait; the racer that answered keeps all it did. The rest lose: signals aborted, unscheduled work dropped, gates released; a step in flight settles, then each losing branch unwinds - undos run, fields restored. Effects without an undo stay. One settling without answering leaves the wait open (a nudge).
- `this.then({ ms, sec, min, hr, day })` - a duration: a wait nothing answers, journaled `wait#n` with `args: [ms]`. Backoff, timeouts, nudges.
- Nothing is buffered: an outside call no wait accepts throws.

## Catch and retry

```ts
this.scan(site).catch((error) => {
  if (this.then.retried >= 3) throw error;
  this.then.retry();                                      // replay scan(site), args recorded
});

protected async scan(site: string) {                     // backoff lives in the retried step
  if (this.then.retried) this.then({ sec: this.then.retried });
  this.fetch(site);
}
```

- A failure in the token's branch (it and its subtree): failing step restored, rest of the branch discarded, the branch's undos run - then the handler runs in its place and the plan continues.
- Handlers replace the branch - retry, fall back, rethrow. `.catch()` skips.
  - `.catch((error) => { … })` - a function, the default: `Promise.catch` semantics, its step calls scheduled; process-local - dropped on restart, so there the run fails instead of recovering.
  - `.catch(this.noCourier)` - a step method, for a durable run whose recovery must survive a restart: runs given the error; recorded with it as `{ name, message, cause }` (an Error; anything else as thrown).
- The handler sees the branch's failed state; once its body returns, the branch's fields are restored except keys it wrote, then what it scheduled runs. `this.then.restore()` restores early.
- It recovers by scheduling, or throws to keep failing - an expected failure is a typed error (`throw new NoCourier()`) the handler checks, rethrowing the rest. A wait in a handler asks for another try; put it under a caught step to catch the next failure too.
- `this.then.retry()` in a handler replays what the catch is attached to - the failed step or the whole group - with its recorded args, under the same handler. The handler holds the policy; past it, throw or fall back. Throws outside a handler; `.catch(this.then.retry)` throws.
- `this.then.retried` - replays so far, `0` on a first run; a handler reads the failed one's. Calling a step again from a handler is a new step - `0`.
- Not caught: rule violations, past `commit()`/irreversible, aborts, failures while stopping or ending.

## Gate

`this.then.only(max, key?)` - a gate, a token: queues FIFO for one of `max` slots; what the step schedules after it runs holding the slot. Returns nothing.

- `max` - number, or `($) => $.limit` read live through the tracking proxy (a UI can change it mid-run); `0` pauses.
- `key` - none: the enclosing group's queue; an object (a shared Model): one queue across instances - `only(1, this.manager)` is a mutex; a primitive: per instance.
- A delay before queueing is a duration ahead of it.

## Stop and end

- `then.stop(reason?)` - halts, keeping what was done: status `stopped`, pending dropped, in-flight steps' signals aborted, the queue rejected; `await this` rejects with a `Steps.Stopped` (`reason` as `cause`), also the step signals' reason. `set(null)` stops.
- `then.abort(reason?)` - halts the same way, then unwinds the run as a failure would - `commit`'s counterpart. Status `aborted`; the run rejects with a `Steps.Aborted` (`stop()`: a `Steps.Stopped`), named as such. An undo throwing fails the run (`failed`, its error given the `'Aborted'` error as `cause`).
- `then.end()` - ends early, keeping everything: in a step at its place in the plan, from outside now. `await this` resolves; the tail builds the result from fields. Why it ended early is data - write a field before calling it. Passing a value throws.
- A failed run nobody awaited throws uncaught two microtasks later.

## Hooks

Only `before` and `after` are hooks (any other name is a step; `then`, `end`, `gate`, `wait` are reserved for plan tokens and throw); protected, synchronous, raw instance as `this`, writes unjournaled.

- `before(step, args)` / `after(step, entry)` around every step. `after` gets each committed entry - the Runner keeps no journal, so a log is `this.log.push(entry)`. A try a catch took arrives with `entry.error`; a called `end` arrives too (an implicit one does not).

Entry: `{ id: 'pay#1', key, args, wrote, next, on?, unwound?, wake?, retried?, error?, irreversible?, committed?, halted?, implicit? }` - no values.

## Runner - `this.then`

`status` (`idle | running | waiting | stopped | aborted | failed`), `active` (step in flight), `queue`, `waiting`, `runs`, `error` - reactive through the instance (`x.get(($) => $.then.status)`, or in a render), enumerable for a `{ ...x.then }` snapshot; `then.get()` snapshots too. `then` is not in `instance.get()`.

## Conventions

- Steps are `protected async`; `run` and answering steps public. `_`-prefixed methods are helpers, not steps - they run on the instance, unmanaged.
- **Coordination first.** A `Steps` class is the process's template. Each step awaits the one call doing its work, then schedules, groups, gates or catches what follows. Request building, stream handling, parsing, choosing between sources go in functions or in a Model the run owns, finds with `get()`, or reports to.
- Report fields (progress, a status line) are ordinary fields written in steps; the UI subscribes. A failed try restores them - that try did not happen. To keep a value across a failed try write it unmanaged (`this.is.progress = p`, a `_` helper, an owned Model), in an undo or catch handler, or in `run`'s tail. UI text is derived from state, not stored.
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
