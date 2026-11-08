# Steps - A Body Is a Plan

Every method on the class is a step - its bases' up to `Steps` included, `Model`'s not ([contract.md](contract.md)). Steps are `protected async` by convention ([README.md](README.md#conventions)), each wrapped as an own non-enumerable property of the instance, the prototype untouched. Not steps: `new`, getters, `_`-prefixed helpers, and `before`/`after` hooks ([hooks.md](hooks.md)). A step runs with a proxy as `this`: writes through it are listed in the entry's `wrote` - and restored if the step fails; reads pass through.

`run` is the entry ([runs.md](runs.md)), never a step to schedule - inside a step, `this.run()` throws `run is the entry - loop with a step: a step which schedules itself again.`

## Calling a step schedules it

Inside a step, calling another step does not run it. It returns an inert token - not awaitable - scheduled after the caller settles cleanly. A caller that throws has scheduled nothing. `await this.a()` is a no-op.

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.pay();                          // token - runs after reserve settles
}
```

Inputs and shared state are ordinary fields. `_` fields are unmanaged - not restored, not observable, not in `wrote`, not checkpointed by a future durable host: only for process-local values like a cache or a handle.

Step arguments are journaled - pass only need-to-know handoffs: what differs between calls, or a value one step found and hands the next. State shared across steps, or read from outside, is a field. Secrets are neither - pass a reference and resolve it in the step that uses it: `const token = await vault.get(cardRef)`.

## Sequence, depth-first

Tokens a step issues run one after another, in issue order. Each runs to completion - including everything it schedules, transitively - before the next sibling starts.

```ts
async run() {
  this.a();                            // a, then all a schedules
  this.b();                            // then b
}

protected async a() {
  await work();
  this.a1();                           // runs before b
}
```

Loops are plain loops, or a step scheduling itself:

```ts
protected async page() {
  const page = await api.page(this.cursor);

  this.cursor = page.next;

  if (page.next) this.page();
}
```

## Parallel groups

`this.then(a, b, …)` takes those tokens out of the sequence and runs them as one group, at the point of the call: members run concurrently, each through its own subtree; the group completes when every member has; the next item in sequence runs after.

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
  this.then.end();                     // once the group is done
}
```

`this.then(items, each)` calls `each(item, index)` per item - a function issuing a step, or a step itself - and groups the tokens. `items` is any iterable.

```ts
this.then(calls, (call) => this.tool(call));
this.then(calls, this.tool);           // tool(call, index)
```

Members must be tokens this step issued (`then() takes steps called by run.`). An array is not a group - `[]` is only the `items` of a mapped group.

## Function handlers

A function given to [`.catch`](catch.md#handlers) runs as an anonymous step: journaled `then#n` (key `then`), its own entry, write guard and hooks. An arrow's `this` is the enclosing step's settled proxy, which hands writes, step calls, collection reads and `this.then` to the handler in flight - its writes are in its entry, its step calls schedule. A `function` gets the handler's own proxy as `this`. Nested arrows resolve to the innermost. The hand-off needs exactly one handler of that step in flight, and no wait that step opened still open; otherwise the settled proxy is as is - writes unmanaged, step calls [settled calls](#calls-after-a-step-settles).

`this.then(fn)` is not a step - it throws `then() takes steps, not a function - declare the work as a step.`

## The step signal

`this.then.signal` is the step's own `AbortSignal` - each step's proxy names its own frame, so parallel members get their own. Pass it to the call the step awaits:

```ts
protected async turn() {
  const reply = await model.create(this.messages, {
    signal: this.then.signal,
    onChunk: (chunk) => this.draft.push(chunk)
  });

  this.draft.clear();
  this.messages.push(reply);
}
```

Aborted on `stop()` and `abort()`, when the run fails elsewhere, when its [race](wait.md#racers) is lost, and once the step settles. A step rejecting with its signal's `reason` after the runtime aborted it is not a new failure: its writes are restored - `draft`'s chunks above - nothing it scheduled runs, it is not caught, it reaches no hook. A different error thrown after the abort fails the run as usual.

Outside a step, `then.signal` throws `signal must be read inside a step.`

## `then` by argument

Inside a step, `this.then`:

- `(...tokens)` - tokens this step issued: a parallel group;
- `(items, each)` - an iterable and a mapper, or a step: a mapped group;
- `(...steps, ...racers)` - steps of this instance uncalled (`this.allow`), plus tokens as [racers](wait.md#racers): a wait ([wait.md](wait.md));
- `({ ms, sec, min, hr, day })` - one plain object: a [duration](wait.md#durations);
- one plain function fails the run: `then() takes steps, not a function - declare the work as a step.`;
- anything else - two plain functions, `await this` included - fails the run: `a step cannot await its own run.`

Its members, in a step: `then.only(max, key?)` ([gate.md](gate.md)), `then.end()` ([end](#end-is-terminal)), `then.on({ … })` ([on.md](on.md#handlers)), `then.commit()` ([on.md](on.md#commit)), `then.signal` ([signal](#the-step-signal)), `then.retried`, `then.retry()` and `then.restore()` ([catch.md](catch.md)).

Every token takes `.catch(handler?)` - a failure in its branch unwinds the branch and the run continues ([catch.md](catch.md)).

Every form returns a token typed `Promise<void>`, as a step call is - not awaitable, `.catch` typed. `then.only()` returns nothing.

Outside a step, `then(f, r)` is the thenable ([runs.md](runs.md#awaiting-the-instance---start-or-join)); `then(steps)` throws `then(steps) must be called inside a step.`

Writes are attributed per frame with members in flight: each member's entry lists its own writes. `active` names the latest member invoked.

## Pending values

A step reading a pending value - an unset `set<T>()`, an async factory, a getter over one - waits for it instead of failing. mvc throws a suspense Promise; the step's try ends there: resets it registered run (newest first), its writes are restored, its tokens dropped, then it runs again from the top once the Promise resolves. No entry for the suspended try, no hooks refired, no [`retried`](catch.md#retry) counted - though token ids it issued stay counted (`report#2` commits). Status stays `running`, `active` names the step.

```ts
class Checkout extends Steps {
  cart!: Cart;
  rate = set<number>();                // assigned by a view, a socket, another step
  total = 0;

  protected async quote() {
    this.total = this.cart.total * this.rate;
  }
}
```

- A rejection is the try's error - [caught](catch.md) if its branch is, else the run fails with it.
- `stop()` while waiting aborts the step as for its [signal](#the-step-signal) - writes restored, no entry, no new failure; `end()` waits for the value.
- A step past [`commit()`](on.md#commit), or with an irreversible change, cannot start over: the Promise fails it as any throw. So does one thrown from an `after` hook.
- Any thrown `Promise` counts, not only mvc's.

## The first step call ends the step's work

After its first token, a step may only issue more tokens, group them, and return. A write through `this` after the first token fails the run (`pay wrote charge after scheduling ship.`). Settling more than a few microtasks after the last token event - a token issued, a group made - fails the run (`pay kept working after scheduling ship.`).

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);   // work, then writes

  this.ship(this.charge.id);                            // scheduling - work is over
}
```

A sync side effect after scheduling - a mailer call - is invisible to the guard. Side effects are steps.

## Calls after a step settles

A step called through the proxy of a step that has settled - from a timer - is an outside call: nothing is buffered. It answers an open wait accepting it - one the settled step opened first, else as any outside call ([wait.md](wait.md#answering-steps)) - or throws `run has settled; second cannot run.` It is bound to its run: once that run ends, every call through it throws. Writes through a settled proxy are unmanaged - in no entry, not restored. A [function handler](#function-handlers) in flight takes both over.

## Helpers

A `_`-prefixed method is not a step - mvc's unmanaged prefix. Never wrapped, called inline, it runs on the instance (`this.is`), not the step's proxy. Its writes are in no entry, pass the write guard, and are not restored on failure; a step it calls is an outside call. A helper computes; the step assigns. A `_` setter is also how a value outlives a failed try - `_progress(p) { this.progress = p }` writes the instance, reactive and never restored; `this.is.progress = p` in the step does the same.

```ts
protected async first() {
  this.value = this._double(2);        // wrote: ['value']
}

private _double(n: number) {
  return n * 2;
}
```

## `end` is terminal

`end` is a token like any other - it runs at its place in the plan, depth-first, and running it ends the run. Whatever is still pending is discarded, not journaled; open waits and slots are released; steps in flight - other members of a group - finish, signals not aborted, and commit; what they schedule never runs. `end()` finishes what's running and schedules nothing more; to halt now, `stop()` or `abort()`. The same as [`then.end()` from outside](runs.md#end-from-outside).

`this.then.end()` takes no value - one throws: the result is what `run` returns once its run is done ([runs.md](runs.md#run-and-the-result)). A class may not declare `end` - it throws at construction. The end is journaled `{ id: 'end#n', key: 'end', args: [], next: [], wrote: [] }`, `implicit: true` when the plan drained. An `end` called - in a step or from outside - is handed to `after` like any entry, so a trace shows where a run was cut short; an implicit one is not.

```ts
async run() {
  this.build();
  this.test();                         // may end early
  this.ship();                         // dropped if test ended the run

  await this;

  return { shipped: !this.failures.length, failures: this.failures };
}

protected async test() {
  this.failures = await suite.run();

  if (this.failures.length) this.then.end();
}
```

An early exit is calling `end` - no flag threaded through later steps.

- `end` must be the last call in its step: a step call, group, wait or gate issued after it fails the run (`end must be the last call in a step.`) - a second `end` included. Registering handlers is not a call - `this.then.end()` may precede `this.then.on(…)`.
- Two branches of a group each scheduling `end`: the first the plan reaches ends the run; the other is discarded with the rest.
- A failure, `stop()` or `abort()` takes precedence - `end` reached after either does nothing; a [caught branch's](catch.md) unwind in progress stops, as for an outside `end`.

From outside, `then.end()` ends the active run now ([runs.md](runs.md#end-from-outside)).

## What a step returns

Nothing. Any value fails the run (`first returned a value; a step returns nothing - its undo is this.then.on({ reset }).`) - a step's reset is one it [registers](on.md#handlers): `this.then.on({ reset: this.release(hold) })`. `run`'s return is the result.

## Entry

Each step that commits is one entry, handed to [`after`](hooks.md) - the runner keeps none ([runner.md](runner.md#entry)):

```ts
{
  id: 'pay#1',                         // key#count, counted per run
  key: 'pay',
  args: [],
  wrote: ['charge'],                   // fields written, collections changed in place included
  next: [                              // what it scheduled
    { id: 'then#1', key: 'then', args: [], group: [
      { id: 'ship#1', key: 'ship', args: ['ch_42'] },
      { id: 'receipt#1', key: 'receipt', args: ['https://…'] }
    ] },
    { id: 'end#1', key: 'end', args: [] }
  ],
  on: { reset: [{ id: 'then#2', key: 'then', args: [] }] }
}
```

Optional: `wake` - the wait a step answered ([wait.md](wait.md)); `error` - a caught failure ([catch.md](catch.md)), or a failing step that kept its writes; `retried` - a replay by `then.retry()`; `unwound` - the unwind ([on.md](on.md#the-unwind)); `irreversible`, `halted` - collection changes no restore can undo ([on.md](on.md#irreversible)); `committed` - [`then.commit()`](on.md#commit); `implicit` - an `end` the runtime added ([end](#end-is-terminal)).

A try a catch took, and the failure that ends the run, reach `after` with `error`. The runtime makes entries no hook is handed, for its own unwind: a suspended try's resets, and an implicit `end`. An entry holds no values - an unwind restores fields from priors the runtime keeps until the run ends ([on.md](on.md#the-unwind)).

Writes from outside the run, through `this.is`, in helpers, or in hooks are in no entry.
