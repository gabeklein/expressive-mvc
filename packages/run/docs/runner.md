# Runner - The Controller

`run(this)` returns a `Runner`: an observable callable, not a State. The field name is the user's - `then` makes the instance awaitable, `run` keeps the controller at `x.run`.

| member | |
| --- | --- |
| `status` | `'running' \| 'done' \| 'failed'` - `running` from construction |
| `step` | key of the step in flight; `''` between steps and after the end |
| `error` | what failed the run, or what its last undo threw |
| `entries` | the journal - one entry per settled step, in commit order |
| `on` | the instance |
| `get()` | `{ status, step, error, entries }` - a plain record |
| `done(value?)` | ends the run once everything else pending has settled |

Entry: `{ id, key, args, prior, patch, next: [{ id, key, args, after }], undo?: 'closure' | { id, key, args, after }, undone?: true | 'failed' }` ([steps.md](steps.md#entry), [undo.md](undo.md)).

## Reactive

`status`, `step`, `error`, `entries` subscribe in a `get()` effect or a render, through the instance:

```ts
order.get((self) => {
  console.log(self.then.status, self.then.step);
});
// running new → running reserve → … → done
```

```ts
const Status = () => {
  const { then } = SubmitOrder.get();

  return <p>{then.status} {then.step}</p>;
};
```

A tracking read of `then` is an observable view - not callable, so not awaitable. `await` the instance outside tracking contexts; inside one, read its members.

## Awaitable

Named `then`, the instance resolves to the result - typed by the class's `done` ([steps.md](steps.md#done-joins)), else `State.Values<T>`:

```ts
const order = SubmitOrder.new({ cart });

const result = await order;            // { orderId, tracking }
await Promise.resolve(order);          // same
```

A `set` factory returning the instance resolves to the result, suspending until then:

```ts
class Checkout extends State {
  receipt = set(async () => SubmitOrder.new({ cart }));
}
```

Named `run`, await the controller: `await x.run`.

## `done()`

`this.then.done(value?)` from a step schedules `done` as the step does - it joins, running last. With a class `done`, `value` is its argument; without one, `value` is the result, else a dump of public values. After the run ends, `done()` throws like any step.

## Outside calls

`new()` is the one call from outside - activation makes it. Any other step called with no step on the stack throws:

- while a step is in flight: `reserve is running; ship cannot be called from outside.`
- after the end: `SubmitOrder is done; ship cannot run.` - `failed` alike.

Writes from outside are allowed. They steer whichever step reads the field next and appear in no patch:

```ts
class Agent extends State {
  then = run(this);
  mode = 'ask';

  protected new() {
    this.turn();
  }

  async turn() {
    const call = await model.sample();

    let allowed = this.mode == 'yolo';

    if (allowed) this.exec(call);
    else this.then.done('needs approval');
  }

  async exec(call: ToolCall) {
    await tools.run(call);
  }
}

const agent = Agent.new();

agent.mode = 'yolo';                   // turn reads 'yolo' - exec runs
```
