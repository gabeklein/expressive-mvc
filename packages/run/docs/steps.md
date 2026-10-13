# Steps - A Body Is a Plan

Every method on the class, bases included, is a step - `protected async` by convention ([README.md](README.md#conventions)) - wrapped as an own non-enumerable property of the instance, the prototype untouched. Not steps: `new`, getters, `_`-prefixed helpers, and `before`/`after` hooks ([hooks.md](hooks.md)). A step runs with a proxy as `this`: writes through it are the entry's `patch`, with `prior` values recorded; reads pass through.

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

`this.then(tokens)` takes those tokens out of the sequence and runs them as one group, at the point of the call: members run concurrently, each through its own subtree; the group completes when every member has; the next item in sequence runs after.

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.then([this.ship(this.charge.id), this.receipt(this.charge.receiptUrl)]);
  this.end();
}
```

`this.then(items, each)` calls `each(item, index)` per item - a function issuing a step, or a step itself - and groups the tokens. `items` is any iterable.

```ts
this.then(calls, (call) => this.tool(call));
this.then(calls, this.tool);           // tool(call, index)
```

Members must be tokens this step issued (`then() takes steps called by next.`).

## `then` by argument

Inside a step, `this.then`:

- `(tokens)` - an iterable first: a parallel group;
- `(items, each)` - an iterable and a mapper, or a step: a mapped group;
- `(...steps)` - every argument a step of this instance (`this.allow`): a wait ([wait.md](wait.md));
- anything else - `await this` included - fails the run: `a step cannot await its own run.`

Outside a step, `then(f, r)` is the thenable ([runs.md](runs.md#awaiting-the-instance---start-or-join)); `then(steps)` throws `then(steps) must be called inside a step.`

Writes are attributed per frame with members in flight: each member's `patch` holds its own writes. `active` names the latest member invoked.

## The first step call ends the step's work

After its first token, a step may only issue more tokens, group them, and return. A write through `this` after the first token fails the run (`pay wrote charge after scheduling ship.`). Settling more than a few microtasks after the last token event - a token issued, a group made - fails the run (`pay kept working after scheduling ship.`).

```ts
protected async pay() {
  this.charge = await stripe.charge(this.cart.total);   // work, then writes

  this.ship(this.charge.id);                            // scheduling - work is over
}
```

A sync side effect after scheduling - a mailer call - is invisible to the guard. Side effects are steps.

A step called on a frame that has already settled - from a timer, say - throws `next has settled; second cannot run.`

## Helpers

A `_`-prefixed method is not a step - mvc's unmanaged prefix. Never wrapped, called inline, it runs on the instance (`this.is`), not the step's proxy. Its writes are in no `patch` or `prior`, pass the write guard, and are not rolled back on failure; a step it calls is an outside call. A helper computes; the step assigns.

```ts
protected async first() {
  this.value = this._double(2);        // patch: { value: 4 }
}

_double(n: number) {
  return n * 2;
}
```

## `end` joins

`end` runs once, after everything else in the run - wherever it was scheduled. A class-declared `end(value)` is a step that types the result: its return, else its argument. `this.then.end(value?)` is the controller form - an undeclared `end`, or an early end; with a class `end`, `value` is its argument. With neither a return nor an argument, the result is a dump of the class's public values, the `Runner` excluded. A run whose plan drains without `end` ends with the dump.

```ts
async next() {
  this.end();                          // runs last
  this.a();
}

protected end() {
  return { orderId: this.charge!.id, tracking: this.tracking };
}
```

`end` scheduling a step fails the run (`end cannot schedule more.`), as does scheduling `end` twice (`end was scheduled twice.`). From outside, `instance.end` reads `undefined`; `then.end(value)` ends the active run early ([runs.md](runs.md#end-from-outside)).

## What a step returns

Nothing, a closure (its undo), or a token it issued - `return this.release(id)` registers that step as its undo and removes it from the plan ([undo.md](undo.md)). Any other value fails the run (`first returned a value; a step returns nothing, or its undo.`). `end`'s return is the result.

## Entry

Each settled step is one journal entry (`record` on the [runner](runner.md)):

```ts
{
  id: 'pay#1',                         // key#count, counted per run
  key: 'pay',
  args: [],
  prior: { charge: undefined },        // values before the step's first write to each
  patch: { charge: { id: 'ch_42', … } },
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

Optional: `wake` - the wait a step answered ([wait.md](wait.md)); `attempt`, `error` - retries ([retry.md](retry.md)); `undone` - the unwind ([undo.md](undo.md)).

Writes from outside the run, through `this.is`, in helpers, or in hooks are in no patch.
