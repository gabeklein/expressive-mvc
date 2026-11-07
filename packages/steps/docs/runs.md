# Runs - `run`, Repeat, Queue, Stop, Steering

## `run` starts a run

From outside a step, `run(...args)` is the one callable step: it starts a run and returns a Promise settling with it - the result, or the error. Any other step reads `undefined` from outside, except one an open wait accepts ([wait.md](wait.md)); a held reference called with no wait accepting it throws `ship cannot be called from outside; call run() to start a run.`

```ts
class Agent extends Steps {
  messages = has<Message>();

  async run(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }
}

const reply = await agent.run('ship it');
```

`run`'s parameters also decide whether awaiting an idle instance can start a run - see [Awaiting the instance](#awaiting-the-instance---start-or-join); an optional parameter needs a default.

Nothing starts on its own. A class wanting a run on creation writes `new() { this.run(); }`. An `async new()` holds the instance's `ready` and its effects, not a run it starts - so `async new() { await this.run(); }` works, and effects watching `then` start once it resolves.

## Runs repeat

A finished run returns status to `idle`; the next `run()` starts a fresh run with its own ids. Instance fields persist across runs. `runs` counts finished runs - ended, failed or stopped. `status` `stopped`/`failed` and `error` hold until the next run starts.

```ts
await agent.run('write notes');
await agent.run('now the tests');     // messages kept, then.runs == 2
```

## Queue

`run()` from outside while a run is active queues a run, first in first out. `then.queue` lists the queued argument arrays, reactive. Each call's Promise settles with its own run. A failed run does not clear the queue.

```ts
const first = agent.run('write notes');
const second = agent.run('read docs');

agent.then.queue;                      // [['read docs']]
```

## Awaiting the instance - start or join

Named `then`, the Runner makes the instance a thenable. Awaiting it:

- idle with nothing queued - calls `run()` with no arguments, as an outside call would, then joins that run; if `run` declares parameters, rejects instead: `Agent-… is idle. run() takes arguments; call it to start a run.`;
- otherwise joins - settles once the active run and everything queued behind it have, with the last run's result; rejects if that last run failed or was stopped. Any `run` signature.

```ts
const result = await SubmitOrder.new({ cart });   // runs run()
await Promise.resolve(order);                     // same
```

```ts
agent.run('ship it');
await agent;                                      // joins - 'done'
await agent;                                      // idle - rejects; await agent.run(prompt)
```

> **Optional parameters.** The check is `run.length`, which counts a TS-optional parameter - `run(prompt?: string)` rejects on an idle await. Give it a default instead: `run(prompt = '')` has length 0, so an idle await starts it.

A `set` factory returning the instance resolves to the result, suspending until then:

```ts
class Checkout extends Model {
  receipt = set(async () => SubmitOrder.new({ cart }));
}
```

## `run` and the result

`run` absorbs arguments, schedules steps, `await this` for the run, and returns the result:

```ts
async run(ref: LoraRef) {
  this.ref = ref;                      // setup: fields and step calls only
  this.lookup();

  try {
    await this;                        // the run - everything scheduled, to the end
  } catch {
    return { failed: true as const };  // a failure or stop, turned into a result
  }

  return { file: this.file, name: ref.name };
}
```

- Before `await this`, `run` is an ordinary step - its writes and calls are its entry, committed there; what it scheduled starts then. Awaiting anything else first fails the run (`run awaited work before its plan - it takes arguments, calls steps and awaits this.`) - work belongs in steps, so the durable tier can re-enter `run` without redoing any. The check is the [lateness guard](steps.md#the-first-step-call-ends-the-steps-work)'s: an await settling within a few microtasks slips through.
- `await this` resolves once the plan drains or `then.end()` ends it; it rejects with the failure or the `'Stopped'` error, after the unwind.
- After it, `run` is the tail: it reads fields and returns or throws. Step calls throw, as through any settled step; writes are unmanaged.
- The run settles with what `run` returns or throws. `then.status` and `then.error` record what the plan did, so the two can disagree: a tail catching a failure resolves the run while status stays `failed` - a handled rejection; one throwing after a clean plan fails it.
- The tail is where cleanup on every outcome goes - `try`/`catch`/`finally` around `await this` ([hooks.md](hooks.md#cleanup)). A run without `await this`, or failing before `run` reaches it, has no tail.
- Without `await this`, `run` settles at once and its return is the result - `void` for the chained style.
- `x.run(...)` and `await x` are typed by `run`'s return. `run` is declared `async` - a sync one is a type error, since `x.run()` must be awaitable. Returning the awaited value - `return await this` - is circular (TS7023): `run` would be typed by itself.

## End from outside

`then.end()` from outside ends the active run now, without undoing anything - what an `end` token does when the plan reaches it ([steps.md](steps.md#end-is-terminal)):

- pending steps are discarded - not journaled; open waits are released;
- in-flight steps' [signals](steps.md#the-step-signal) abort; they settle and commit - what they schedule never runs; one rejecting with its signal's reason is dropped, its writes restored;
- then `await this` in `run` resolves and the run settles with what `run` returns, as a normal end;
- the queue proceeds - the next queued run starts.

Idle, or with the run already ending, stopped or failed, it does nothing. A step in flight failing meanwhile fails the run as usual.

## Stop and abort

`then.stop(reason?)` - or `this.then.stop()` in a step - halts the active run, keeping what was done, rejecting it and the queue:

- status `stopped` at once; pending steps are discarded; open waits are released;
- in-flight steps' [signals](steps.md#the-step-signal) abort; they settle and commit - `after` sees their entries, what they schedule never runs; one rejecting with its signal's reason is dropped, its writes restored;
- queued runs are dropped: `queue` empties, each queued Promise rejects with a `Steps.Stopped` - named `'Stopped'`, `instanceof` works;
- once in-flight steps have settled, the run's Promise rejects with that error.

Stopped in `run`'s tail - the plan already done - the current run finishes with what `run` returns; only the queue rejects.

`reason` is that error's `cause`, and its message when a string - else `` `${instance} was stopped.` ``. undos and the tail see the same error; `then.error` stays unset.

`then.abort(reason?)` halts the same way, then unwinds the run as a failure would ([on.md](on.md)) - the counterpart of [`commit`](on.md#commit). Status `aborted`; the run, the queue and `close` handlers get a `Steps.Aborted` (named `'Aborted'`) - `reason` as for `stop`, `` `${instance} was aborted.` `` without one. An undo that throws fails the run: status `failed`, `error` and the rejection are what it threw, given the `'Aborted'` error as `cause` when it is an Error without one. During a [caught branch's](catch.md) unwind, `stop()` stops it between undos. Stopping when idle does nothing. `set(null)` on the instance stops it. Finishing never destroys the instance.

A stopped run is not rethrown uncaught.

## Unawaited failures

A failed run nobody awaited - neither `run()`'s Promise nor the instance - rethrows uncaught two microtasks after rejecting. `await` it, or `.then` it, before then - or let it surface.

## Steering - a mailbox

A field written from outside steers whichever step reads it next ([runner.md](runner.md#steering)). For input meant to reach a run in progress without starting another, keep a `has()` list as a mailbox and let the loop pull from it - opinionated recipe, not API:

```ts
class Agent extends Steps {
  messages = has<Message>();
  inbox = has<string>();

  async run(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages, { signal: this.then.signal });
    const notes = this.inbox.pop(0, this.inbox.size);

    this.messages.push(reply, ...notes.map(user));

    if (toolCalls(reply).length || notes.length) this.turn();
  }
}

agent.inbox.push('use pnpm, not npm');  // read at the end of the current turn
```

The outside push is unmanaged; the pull happens inside a step, so it is in that step's entry and restored with it if the step fails. `run()` mid-run queues a whole run instead ([Queue](#queue)).
