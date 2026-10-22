# Runs - `next`, Repeat, Queue, Stop, Steering

## `next` starts a run

From outside a step, `next(...args)` is the one callable step: it starts a run and returns a Promise settling with it - the result, or the error. Any other step reads `undefined` from outside, except one an open wait accepts ([wait.md](wait.md)); a held reference called with no wait accepting it throws `ship cannot be called from outside; call next() to run.`

```ts
class Agent extends Job {
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

- idle with nothing queued - calls `next()` with no arguments, as an outside call would, then joins that run; if `next` declares parameters, rejects instead: `Agent-… is idle. next() takes arguments; call it to start a run.`;
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
class Checkout extends Model {
  receipt = set(async () => SubmitOrder.new({ cart }));
}
```

Named `run`, the controller is the thenable: `await x.run`.

## End from outside

`then.end(value?)` from outside ends the active run now, without undoing anything - what an `end` token does when the plan reaches it ([steps.md](steps.md#end-is-terminal)):

- pending steps are discarded - not journaled; open waits are released;
- in-flight steps' [signals](steps.md#the-step-signal) abort; they settle and commit - what they schedule never runs; one rejecting with its signal's reason is dropped, its writes restored;
- then `end` runs with `value` - the class's `end` if declared, else the result is `value`, else the dump - and the run resolves with the result as a normal end;
- the queue proceeds - the next queued run starts.

Idle, or with the run already ending, stopped or failed, it does nothing. A step in flight failing meanwhile fails the run as usual.

## Stop

`then.stop(undo?, reason?)` - or `this.then.stop()` in a step - cancels the active run, rejecting it and the queue:

- status `stopped` at once; pending steps are discarded; open waits are released;
- in-flight steps' [signals](steps.md#the-step-signal) abort; they settle and commit - their entries are recorded, what they schedule never runs; one rejecting with its signal's reason is dropped, its writes restored;
- queued runs are dropped: `queue` empties, each queued Promise rejects with an error named `'Stopped'`;
- once in-flight steps have settled, the run's Promise rejects with that error.

`reason` is that error's `cause`, and its message when a string - else `` `${instance} was stopped.` ``. `back` and `exit` see the same error; `then.error` stays unset.

`stop(true)` also unwinds the run as a failure would ([undo.md](undo.md)), `back` included; an undo or `back` that throws sets `error` and the run rejects with it. During an unwind parked on a [returned wait](undo.md#a-returned-wait), `stop()` halts the unwind there; the run rejects with the failure, `reason` recorded on the halted entry and in `exit`'s `stopped`. Stopping when idle does nothing. `set(null)` on the instance stops it. Finishing never destroys the instance.

`exit` runs last for every stopped run ([hooks.md](hooks.md#exit)). A stopped run is not rethrown uncaught.

## Unawaited failures

A failed run nobody awaited - neither `next()`'s Promise nor the instance - rethrows uncaught two microtasks after rejecting. `await` it, or `.then` it, before then - or let it surface.

## Steering - a mailbox

A field written from outside steers whichever step reads it next ([runner.md](runner.md#steering)). For input meant to reach a run in progress without starting another, keep a `has()` list as a mailbox and let the loop pull from it - opinionated recipe, not API:

```ts
class Agent extends Job {
  messages = has<Message>();
  inbox = has<string>();

  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages, { signal: this.then.signal });
    const notes = this.inbox.pop(0, this.inbox.size);

    this.messages.push(reply, ...notes.map(user));

    if (toolCalls(reply).length || notes.length) this.turn();
    else this.end(reply);
  }
}

agent.inbox.push('use pnpm, not npm');  // read at the end of the current turn
```

The outside push is unmanaged; the pull happens inside a step, so it is in that step's entry and restored with it if the step fails. `next()` mid-run queues a whole run instead ([Queue](#queue)).
