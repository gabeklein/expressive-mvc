# Steps - A Body Is a Plan

Every method on the class is a step - its bases' up to `Job` included, `Model`'s not ([job.md](job.md)). Steps are `protected async` by convention ([README.md](README.md#conventions)), each wrapped as an own non-enumerable property of the instance, the prototype untouched. Not steps: `new`, getters, `_`-prefixed helpers, and `before`/`after` hooks ([hooks.md](hooks.md)). A step runs with a proxy as `this`: writes through it are listed in the entry's `wrote` - and restored if the step fails; reads pass through.

`next` is the entry ([runs.md](runs.md)). Inside a step, `this.next(x)` is an ordinary step call - how a loop repeats.

## Calling a step schedules it

Inside a step, calling another step does not run it. It returns an inert token - not awaitable - scheduled after the caller settles cleanly. A caller that throws has scheduled nothing. `await this.a()` is a no-op.

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.pay();                          // token - runs after reserve settles
}
```

## Sequence, depth-first

Tokens a step issues run one after another, in issue order. Each runs to completion - including everything it schedules, transitively - before the next sibling starts.

```ts
async next() {
  this.a();                            // a, then all a schedules
  this.b();                            // then b
}

protected async a() {
  await work();
  this.a1();                           // runs before b
}
```

Loops are plain loops, or `this.next()` again:

```ts
async next(until: number) {
  let done = this.count == until;

  if (done) return;

  this.count++;
  this.next(until);
}
```

## Parallel groups

`this.then(a, b, …)` takes those tokens out of the sequence and runs them as one group, at the point of the call: members run concurrently, each through its own subtree; the group completes when every member has; the next item in sequence runs after.

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
  this.end();                          // once the group is done
}
```

`this.then(items, each)` calls `each(item, index)` per item - a function issuing a step, or a step itself - and groups the tokens. `items` is any iterable.

```ts
this.then(calls, (call) => this.tool(call));
this.then(calls, this.tool);           // tool(call, index)
```

Members must be tokens this step issued (`then() takes steps called by next.`). An array is not a group - `[]` is only the `items` of a mapped group.

## Inline steps

`this.then(fn)` with one plain function is an anonymous step: journaled `then#n` (key `then`, `args: []`) and run in its place in the plan as a full step - its own entry, write guard, return guard, hooks with key `then`. It receives its [signal](#the-step-signal), so a `fetch` or timer ends early. Not durable - the function lives in memory.

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.then(async (signal) => {
    await fetch(this.cart.hook, { method: 'POST', signal });
  });
}
```

Like any step it returns nothing or its undo - an arrow returning `fetch(…)` fails the run.

An arrow and a `function` are equivalent: a `function` gets the inline step's own proxy as `this`; an arrow's `this` is the enclosing step's settled proxy, which hands writes, step calls, collection reads and `this.then` to the inline step in flight - its writes are in its entry and restored on throw, its step calls schedule, `this.then.signal` is its own. Nested arrows resolve to the innermost.

The hand-off needs exactly one inline step of that step in flight, and no wait that step opened still open. Two inline arrows of one step running at once - a group of them - see the settled proxy as is: writes unmanaged, step calls [settled calls](#calls-after-a-step-settles). Use `function`, or a method step, there. While the step's wait is open, its proxy stays its [watchers'](wait.md#watchers). Anything else calling through it meanwhile - a timer, a lost watcher - lands in the inline step.

Returned, an inline step is the step's undo ([undo.md](undo.md#a-returned-token)), typed `Promise<void>` as a step call is, so the step stays `Promise<void>`:

```ts
return this.then(() => stripe.refund(this.charge!.id));
```

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

Aborted on `stop()`, on an outside [`end`](runs.md#end-from-outside), when the run fails elsewhere, and once the step settles. A step rejecting with its signal's `reason` after the runtime aborted it is not a new failure: its writes are restored - `draft`'s chunks above - nothing it scheduled runs, it is not caught, no entry. A different error thrown after the abort fails the run as usual.

Inline steps and watchers also receive their signal as a parameter - a watcher's `this.then.signal` is the settled step's, already aborted. Outside a step, `then.signal` throws `signal must be read inside a step.`

## `then` by argument

Inside a step, `this.then`:

- `(...tokens)` - tokens this step issued: a parallel group;
- `(items, each)` - an iterable and a mapper, or a step: a mapped group;
- `(...steps)` - steps of this instance (`this.allow`), plus any plain functions as watchers: a wait ([wait.md](wait.md));
- `(fn)` - one plain function: an inline step;
- tokens mixed with functions fail the run: `then() takes called steps or step references, not both.`;
- anything else - two plain functions, `await this` included - fails the run: `a step cannot await its own run.`

Its members, in a step: `then.end(value?)` ([end](#end-is-terminal)), `then.back(step, reason?)` ([undo.md](undo.md#back)), `then.slot({ max, after, key })` ([slot.md](slot.md)), `then.commit()` ([undo.md](undo.md#commit)), `then.signal` ([signal](#the-step-signal)), `then.retry` and `then.caught` ([catch.md](catch.md)).

Every token takes `.catch(handler?)` - a failure in its branch unwinds the branch and the run continues ([catch.md](catch.md)).

Every form returns a token typed `Promise<void>`, as a step call is - not awaitable, `.catch` typed; returned from a step, it is the step's undo ([undo.md](undo.md#a-returned-token)). `then.slot()` is typed `void`.

Outside a step, `then(f, r)` is the thenable ([runs.md](runs.md#awaiting-the-instance---start-or-join)); `then(steps)` throws `then(steps) must be called inside a step.`

Writes are attributed per frame with members in flight: each member's entry lists its own writes. `active` names the latest member invoked.

## Pending values

A step reading a pending value - an unset `set<T>()`, an async factory, a getter over one - waits for it instead of failing. mvc throws a suspense Promise; the step's try ends there: its writes are restored, its tokens dropped, then it runs again from the top once the Promise resolves. No entry for the suspended try, no hooks refired, no [`retry`](catch.md#retry) counted - though token ids it issued stay counted (`report#2` commits). Status stays `running`, `active` names the step.

```ts
class Checkout extends Job {
  cart!: Cart;
  rate = set<number>();                // assigned by a view, a socket, another step
  total = 0;

  protected async quote() {
    this.total = this.cart.total * this.rate;
  }
}
```

- A rejection is the try's error - [caught](catch.md) if its branch is, else the run fails with it.
- `stop()` or an outside `end` while waiting aborts the step as for its [signal](#the-step-signal) - writes restored, no entry, no new failure.
- A step past [`commit()`](undo.md#commit), or with an irreversible change, cannot start over: the Promise fails it as any throw. So does one thrown from an `after` hook.
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

A step called through the proxy of a step that has settled - from a timer, a watcher - is an outside call: nothing is buffered. It answers an open wait accepting it - one the settled step opened first, else as any outside call ([wait.md](wait.md#answering-steps)) - or throws `next has settled; second cannot run.` It is bound to its run: once that run ends, every call through it throws. Writes through a settled proxy are unmanaged - in no entry, not restored. An [inline arrow](#inline-steps) in flight takes both over.

## Helpers

A `_`-prefixed method is not a step - mvc's unmanaged prefix. Never wrapped, called inline, it runs on the instance (`this.is`), not the step's proxy. Its writes are in no entry, pass the write guard, and are not restored on failure; a step it calls is an outside call. A helper computes; the step assigns.

```ts
protected async first() {
  this.value = this._double(2);        // wrote: ['value']
}

private _double(n: number) {
  return n * 2;
}
```

## `end` is terminal

`end` is a token like any other - it runs at its place in the plan, depth-first, and running it ends the run. Whatever is still pending is discarded, not journaled; open waits and slots are released; steps in flight - other members of a group - have their [signals](#the-step-signal) aborted, settle and commit, and what they schedule never runs. The same as [`then.end()` from outside](runs.md#end-from-outside).

A class-declared `end(value)` is a step that types the result: its return, else its argument. `this.then.end(value?)` is the controller form - an undeclared `end`; with a class `end`, `value` is its argument. With neither a return nor an argument, the result is a dump of the class's public values, the `Runner` excluded. A run whose plan drains without `end` ends with the dump, journaling `{ id: 'end#n', key: 'end', args: [], next: [], wrote: [], implicit: true }` - no hooks.

```ts
async next() {
  this.build();
  this.test();                         // may end early
  this.ship();                         // dropped if test ended the run
}

protected async test() {
  const failures = await suite.run();

  if (failures.length) this.end({ shipped: false, failures });
}
```

An early exit is calling `end` - no flag threaded through later steps.

- `end` must be the last call in its step: a step call, group, wait or slot issued after it fails the run (`end must be the last call in a step.`) - a second `end` included. Returning a token as the undo is not a call - `this.end(); return this.refund(id);` stands.
- Two branches of a group each scheduling `end`: the first the plan reaches ends the run; the other is discarded with the rest.
- A failure or `stop()` takes precedence - `end` reached after either does nothing; a [`back`](undo.md#back) in progress stops, as for an outside `end`.
- `end` scheduling a step fails the run (`end cannot schedule more.`).

From outside, `instance.end` reads `undefined`; `then.end(value)` ends the active run now ([runs.md](runs.md#end-from-outside)).

## What a step returns

Nothing, `true` or `false`, a closure (its undo), or a token it issued - a step, group, wait or inline step: `return this.release(id)` registers that step as its undo and removes it from the plan ([undo.md](undo.md)). An undo or `true` also has an unwind restore the step's fields ([undo.md](undo.md#restoring-fields)); nothing or `false`, not. Any other value fails the run (`first returned a value; a step returns nothing, true, or its undo.`). `end`'s return is the result.

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
  undo: { id: 'refund#1', key: 'refund', args: ['ch_42'] }
}
```

Optional: `wake` - the wait a step answered ([wait.md](wait.md)); `error` - a caught failure ([catch.md](catch.md)), or a failing step that kept its writes; `retry` - a re-run from its own catch; `undone` - the unwind ([undo.md](undo.md)); `irreversible`, `halted` - collection changes no restore can undo ([undo.md](undo.md#irreversible)); `committed` - [`then.commit()`](undo.md#commit); `implicit` - an `end` the runtime added ([end](#end-is-terminal)).

The runtime makes entries no hook is handed, for its own unwind: a failed try that was caught or kept its writes (`error`), a `back` (`to`, `reason` - [undo.md](undo.md#back)), an implicit `end`, and an unwind's answer to a returned wait (`wake`). An entry holds no values - an unwind restores fields from priors the runtime keeps for steps that opted in ([undo.md](undo.md#restoring-fields)).

Writes from outside the run, through `this.is`, in helpers, or in hooks are in no entry.
