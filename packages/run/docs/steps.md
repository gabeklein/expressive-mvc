# Steps - A Body Is a Plan

Every method on the class, bases included, is a step - wrapped as an own non-enumerable property of the instance, the prototype untouched. A step runs with a proxy as `this`: writes through it are the entry's `patch`, with `prior` values recorded; reads pass through.

## Calling a step schedules it

Inside a step, calling another step does not run it. It returns an inert token, scheduled after the caller settles cleanly - a caller that throws has scheduled nothing.

```ts
async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.pay();                          // token - runs after reserve settles
}
```

Tokens issued together fork: they run serially, in issue order, each after the previous settles.

```ts
async pay() {
  this.charge = await stripe.charge(this.cart.total);

  this.ship(this.charge.id);           // ship#1
  this.receipt(this.charge.receiptUrl); // receipt#1 - after ship settles
}
```

## `await` is order, `Promise.all` is join

`await this.a()` resolves at once with an opaque handle; it records order only. A token depends on every token awaited before it was issued (`after: [...ids]`), so awaiting in sequence chains, and `Promise.all` joins a fork.

```ts
protected async new() {
  await this.a();                      // after: []
  await this.b();                      // after: ['a#1']
  this.c();                            // after: ['a#1', 'b#1']
}
```

```ts
protected async new() {
  await Promise.all([this.a(), this.b()]);

  this.c();                            // after: ['a#1', 'b#1']
}
```

Loops are plain loops.

```ts
async sync() {
  for (const item of this.items) this.fetch(item.id);
}
```

## The first step call ends the step's work

After scheduling, a step may only schedule more, await tokens, and return. A write through `this` after the first token fails the run (`pay wrote charge after scheduling ship.`). Settling more than a few microtasks after the last token event fails the run (`pay kept working after scheduling ship.`) - each token issued or awaited re-arms the guard.

```ts
async pay() {
  this.charge = await stripe.charge(this.cart.total);   // work, then writes

  this.ship(this.charge.id);                            // scheduling - work is over
}
```

A sync side effect after scheduling - a mailer call - is invisible to the guard. Side effects are steps: `this.receipt(url)`, not `mail.send(url)` after `this.ship()`.

## Helpers

A `_`-prefixed method is not a step: never wrapped, called inline, its result used by the caller.

```ts
first() {
  this.value = this._double(2);        // patch: { value: 4 }
}

_double(n: number) {
  return n * 2;
}
```

A helper's `this` is the instance, not the frame - a write inside one is not journaled. Write in the step.

## `done` joins

`done` runs only once nothing else is pending, wherever it was scheduled. A class-declared `done(value)` is a step that types the result - its return, or its argument when it returns nothing. `done` may not schedule; scheduling it twice fails the run.

```ts
protected new() {
  this.done();                         // runs last
  this.a();
}

async a() {
  this.b();
}

done() {
  return { orderId: this.charge!.id, tracking: this.tracking };
}
```

`this.then.done(value?)` is the controller form - an undeclared `done`, or an early end. With a class `done`, the value passed is its argument.

```ts
async first() {
  let empty = this.items.size == 0;

  if (empty) this.then.done('nothing to do');
  else this.second();
}
```

A plan that drains without `done` ends with a dump of the class's public values, the `Runner` excluded.

```ts
class Count extends State {
  then = run(this);
  count = 0;

  protected new() {
    this.a();
  }

  a() {
    this.count = 1;
  }
}

await Count.new();                     // { count: 1 }
```

## What a step returns

Nothing, a closure (its undo), or a token - `return this.release(id)` registers that step as the undo ([undo.md](undo.md)). Any other value fails the run (`first returned a value; a step returns nothing, or its undo.`). `done`'s return is the result.

## Entry

Each settled step is one journal entry (`entries` on the [runner](runner.md)):

```ts
{
  id: 'pay#1',                         // key#count
  key: 'pay',
  args: [],
  prior: { charge: undefined },        // values before the step's first write to each
  patch: { charge: { id: 'ch_42', … } },
  next: [                              // tokens it scheduled
    { id: 'ship#1', key: 'ship', args: ['ch_42'], after: [] },
    { id: 'receipt#1', key: 'receipt', args: ['https://…'], after: [] },
    { id: 'done#1', key: 'done', args: [], after: [] }
  ],
  undo: { id: 'refund#1', key: 'refund', args: ['ch_42'], after: [] }
}
```

Writes from outside the run, and through `this.is`, are not in any patch.
