# On - Outcomes, All or Nothing

A step returns nothing. One that changes the world registers what happens on each outcome with `this.then.on({ … })`. An unwind - a failed run, `abort()`, a failure a [`.catch`](catch.md) takes, or a [lost race](wait.md#racers) - goes back through the committed steps newest first, running each one's handlers, then restores the fields of every step it took back.

Every step is atomic: one that throws or is aborted has its own writes restored - fields and [collections](#collections).

## Handlers

```ts
protected async create(row: Row) {
  await Image.insert(row);

  this.then.on({
    abort: async () => {
      this.status = 'cancelled';
      await Image.delete(this.name);
    },
    close: async (reason) => {
      this.preview.close();

      if (reason === undefined || this.status == 'cancelled') return;

      this.status = 'error';
      await Image.update(this.name, { status: 'error' });
    }
  });

  this.start();
}
```

Register right after the effect - as `defer` would - usually just above what the step schedules. A handler is a function - an arrow, writing through the step's `this`; one line is an expression (`undo: () => removeThumb(name)`), more an async arrow with `await`. It is awaited before the next.

A handler covers its step and everything it schedules - the subtree. Outcomes, deepest step first, newest first within a step:

| key | fires | given |
| --- | --- | --- |
| `catch` | a step below failed, no `.catch` closer to it took it - recovery: return recovers, throw passes it on | the error |
| `abort` | `abort()`, or the subtree lost a [race](wait.md#racers) - then `undo` | the `'Aborted'` error |
| `undo` | a failure left the subtree, or `abort`: take back what the step did | the error |
| `stop` | `stop()` while the subtree was unfinished - nothing is undone | the `'Stopped'` error |
| `close` | the subtree ended, any way - a finally over it, last | why: `undefined` if it ended cleanly, else the error, `'Aborted'` or `'Stopped'` error |

- To observe a failure without recovering, read `reason` in `close`; `catch` is for recovery.
- `catch` returning recovers at this step: the failed part of its subtree unwinds - undos, fields restored - the step's own effects stay and its `undo` does not run; steps the handler schedules replace the rest of the subtree. Throwing - the error or a new one - passes the failure on, and `undo` runs as it leaves. It covers from registration on, the rest of the step's own body included - a try opening at the `on()` line; a throw there resets the step (writes restored, undos so far run) before `catch` decides. One per step. `this.then.retry()` in it replays the step with its recorded args. See [catch.md](catch.md#a-calls-catch-or-a-steps-own) for `.catch` beside it.
- `close` gets `undefined` for a failure recovered below or by this step's `catch`, and when [`then.end()`](steps.md#end-is-terminal) cuts the run short - from the run's view it ended cleanly. On a clean finish it runs before the next step in sequence; one that throws fails that subtree, as a step would.
- A step completed earlier, taken back by a later failure, gets `undo` only; `abort` reaches every step taken back.
- Registration is synchronous, anywhere in the body, any number. An unknown key throws `then.on() takes undo, catch, abort, stop and close - got finally.`; an `undefined` value is skipped.
- Registered before its step fails, a handler runs for that failure too and sees the step's partial writes - restored after `undo`.
- Handlers run before fields are restored, so they read the state as the run left it. Keys they write are kept.
- A handler that throws fails the unwind there. `end`, gates and waits throw in one: `end() cannot run in an undo.`
- `run` registers none - `run cleans up in its tail - try/catch around await this.` Cleanup there is a [tail](runs.md#run-and-the-result).

### Steps as handlers - durable runs

A function lives in this process. For a durable run - future - whose compensation is an external effect that must survive a restart, a handler can be a step called for it: `{ undo: this.release(hold) }`, several in an array run as one group. A step called for `catch` is scheduled in the failed part's place and reads the error from `this.then.error`. Claimed, not scheduled; recorded with their args, which they run with; they reach `before`/`after` and are taken back by nothing. An array mixing steps and functions throws `then.on() takes called steps or step references, not both.`; a bare step method throws - call it.

Entry: `on: { undo: [{ id: 'then#2', key: 'then', args: [] }] }` - by outcome; `then` for a function, the step's node for a step, a group node for several. Ids are minted at registration, so a handler never run leaves a gap.

## The unwind

A step that throws, breaks a rule, or returns a value fails the run:

1. Status `failed`, `error` set; pending steps are discarded, open waits released, in-flight steps' [signals](steps.md#the-step-signal) aborted; the failing step's own writes are restored, unless it is [irreversible](#irreversible) or [committed](#commit).
2. Steps still in flight - parallel members - settle; their commits are recorded.
3. Every committed entry, newest first, runs its handlers - `undo`, then `close` where unfinished; a failed step that registered some runs them too.
4. A handler that throws: `unwound: 'failed'`, `error` replaced by what it threw, the unwind stops there.
5. An `irreversible` or `committed` entry stops the undoing: `halted: true` - it and older entries run no `undo`, though `close` still reaches them ([Collections](#collections), [Commit](#commit)).
6. Fields and collection changes of every step taken back are restored - to their values before the earliest such step wrote them - except keys a handler wrote. Each taken-back entry that had an `undo` or wrote is marked `unwound: true`.
7. `await this` in `run` rejects with `error` - the tail runs on the restored fields ([runs.md](runs.md#run-and-the-result)); without one, the run rejects with `error`.

`run`'s own writes are never restored - it is the entry, not a step to take back. `abort()` unwinds the same way with status `aborted`, `abort` before each `undo`, handlers given the `'Aborted'` error; `stop()` runs only `stop` and `close`, restoring nothing ([runs.md](runs.md#stop-and-abort)). A [caught branch](catch.md), an `on({ catch })` recovering - over its step's subtree, the step excluded - and a losing [racer](wait.md#racers) run steps 3-6 over the branch only, and the run goes on.

## Keeping a value

A step's writes are restored whenever an unwind takes it back. To keep one past a failure:

- commit the step - [`this.then.commit()`](#commit) - when everything before it should stand too: an agent's reply, a captured charge;
- write it unmanaged - `this.is.notice = …`, or in a `_` helper, which runs on `this.is`;
- write it in a handler or a [catch handler](catch.md) - their keys are kept;
- write it in `run`'s tail, which runs after the unwind.

## Commit

`this.then.commit()` inside a step is a deliberate point of no return - a charge captured, a message sent:

- its failure is not [caught](catch.md);
- if it throws after `commit()`, its own writes stay; its failing try is journaled with `committed: true` and `error`;
- the unwind stops at its entry - `halted: true` - running none of its undos and nothing before it. No warning: the stop is deliberate.

```ts
protected async pay() {
  this.charge = await stripe.capture(this.intent);
  this.then.commit();

  this.ship(this.charge.id);
}
```

Entry: `committed: true`. Outside a step, `then.commit()` throws `commit must be called inside a step.`; through a settled step's proxy, `pay has settled; commit cannot run.`

## Collections

A `has` list, `has` pool or `map` read by a step through `this` comes back wrapped for that step. Its mutators - list `push`, `put`, `pop`, `set`, `clear`; pool `add`, `delete`, `clear`; map `set`, `delete`, `clear` - record an inverse for the step, then forward to the collection. Reads forward untouched. Mutating it in place - `this.messages.push(x)` - is then part of the step:

- The entry's `wrote` lists the field when the step changed it; a read, or a call changing nothing, records nothing.
- Attribution is per step: parallel steps changing one collection each record their own changes. Restoring a step replays its own inverses, newest first; siblings' changes stay unless they are taken back too.
- An inverse finds what the step left by identity: a pushed or put value is removed at the nearest equal item to where it went; a `set` is put back where its value now is; a popped or cleared value goes back at its old index; a pool member the step added is deleted - destroyed when owned; a map key the step added is deleted, a changed or removed one set back. A value a sibling already removed or replaced is skipped.
- A change through the wrapper after the step's first token fails the run, as a field write does (`run wrote items after scheduling later.`).
- Changes not through a step's wrapper are unmanaged - from outside, through `this.is`, in `_` helpers, or through a wrapper kept after its step settled. A kept wrapper hands a change to the step's [function handler](steps.md#function-handlers) in flight, as the step's proxy does.

### Irreversible

Some changes cannot be put back: a pool member removed by `delete` or `clear`, and a map value destroyed when removed or replaced (an owned `Model`) - unless the step added it itself. Detected per step, through its wrapper; a member destroyed directly is unmanaged. A step making one without registering an undo is irreversible: its entry carries `irreversible: ['<field>', …]`.

- The unwind stops at the first irreversible entry, newest first. Entries after it are taken back; it and every entry before it stay applied; it gets `halted: true`; `error` stays the original failure. `console.warn` names it once: `<instance> stopped unwinding at drop#1: items cannot be restored.`
- A failing step that made one keeps its writes - fields included - and is journaled with `error` and `irreversible`, so the unwind halts there.
- An irreversible step's failure is not caught ([catch.md](catch.md)).
- A step registering an undo is reversible: the unwind runs it, then restores what can be restored.

A map restores through its own `set(key, value)`: a factory map (`map((key) => …)`) passes the old value to its factory, so only keys the step added are restored exactly.

### Plain arrays and objects

`this.cart.items.push(x)` on a plain array or object is not observable - not journaled, not restored. Assign instead: `this.items = [...this.items, x]` is a field write.
