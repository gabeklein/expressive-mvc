# Runs - `next`, Repeat, Queue, Stop

## `next` starts a run

From outside a step, `next(...args)` is the one callable step: it starts a run and returns a Promise settling with it - the result, or the error. Any other step called from outside throws `ship cannot be called from outside; call next() to run.` - except one answering an open wait ([wait.md](wait.md)).

```ts
class Agent extends State {
  then = run(this);
  messages = has<Message>();

  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }
}

const reply = await agent.next('ship it');
```

`next`'s parameters also decide whether awaiting an idle instance can start a run - see [Awaiting the instance](#awaiting-the-instance---start-or-join); an optional parameter needs a default.

Nothing starts on its own. A class wanting a run on creation writes `new() { this.next(); }`.

## Runs repeat

A finished run returns status to `idle`; the next `next()` starts a fresh run with its own `record` and ids. Instance fields persist across runs. `runs` counts finished runs - ended, failed or stopped. `status` `stopped`/`failed` and `error` hold until the next run starts.

```ts
await agent.next('write notes');
await agent.next('now the tests');     // messages kept, then.runs == 2
```

## Queue

`next()` from outside while a run is active queues a run, first in first out. `then.queue` lists the queued argument arrays, reactive. Each call's Promise settles with its own run. A failed run does not clear the queue.

```ts
const first = agent.next('write notes');
const second = agent.next('read docs');

agent.then.queue;                      // [['read docs']]
```

## Awaiting the instance - start or join

Named `then`, the Runner makes the instance a thenable. Awaiting it:

- idle with nothing queued - calls `next()` with no arguments, as an outside call would, then joins that run; if `next` declares parameters, rejects instead: `Agent-… is idle; next() takes arguments - call to start a run.`;
- otherwise joins - settles once the active run and everything queued behind it have, with the last run's result; rejects if that last run failed or was stopped. Any `next` signature.

```ts
const result = await SubmitOrder.new({ cart });   // runs next()
await Promise.resolve(order);                     // same
```

```ts
agent.next('ship it');
await agent;                                      // joins - 'done'
await agent;                                      // idle - rejects; await agent.next(prompt)
```

> **Optional parameters.** The check is `next.length`, which counts a TS-optional parameter - `next(prompt?: string)` rejects on an idle await. Give it a default instead: `next(prompt = '')` has length 0, so an idle await starts it.

A `set` factory returning the instance resolves to the result, suspending until then:

```ts
class Checkout extends State {
  receipt = set(async () => SubmitOrder.new({ cart }));
}
```

Named `run`, the controller is the thenable: `await x.run`.

## Stop

`then.stop()` - or `this.then.stop()` in a step - cancels the active run:

- status `stopped` at once; pending steps are discarded; open waits are released;
- in-flight steps settle and commit - their entries are recorded, what they schedule never runs;
- queued runs are dropped: `queue` empties, each queued Promise rejects with an error named `'Stopped'`;
- once in-flight steps have settled, the run's Promise rejects with that error.

`stop({ undo: true })` also unwinds the run as a failure would ([undo.md](undo.md)); an undo that throws sets `error` and the run rejects with it. Stopping when idle does nothing. `set(null)` on the instance stops it. Finishing never destroys the instance.

A stopped run is not rethrown uncaught.

## Unawaited failures

A failed run nobody awaited - neither `next()`'s Promise nor the instance - rethrows uncaught two microtasks after rejecting. `await` it, or `.then` it, before then - or let it surface.
