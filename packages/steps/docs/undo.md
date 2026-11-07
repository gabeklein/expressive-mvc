# Undo - All or Nothing

A step returns nothing. One that changes the world registers its undo with `this.then.undo(this.release(hold))` - the step that takes it back, called for it. An unwind - a failed run, `stop({ undo: true })`, or a failure a [`.catch`](catch.md) takes - goes back through the committed steps newest first, running each one's undos, then restores the fields of every step it took back.

Every step is atomic: one that throws or is aborted has its own writes restored - fields and [collections](#collections).

Policy: step references are recorded; functions belong to the process.

## Undos

```ts
protected async reserve() {
  const hold = await inventory.hold(this.cart.items);

  this.then.undo(this.release(hold));
  this.pay().catch(this.noCourier);
}
```

Register an undo right after the effect it takes back - as `defer` would - usually just above what the step schedules.

`this.then.undo(…)` takes:

- steps called for it - `this.then.undo(this.release(hold))`; several, `this.then.undo(this.cancel(id), this.refund(charge))`, run as one group. Claimed, not scheduled - the step may keep working and awaiting after. Recorded with their args.
- or one function - process-local: given the error, it runs on unwind in this process and is dropped on restart. Right for process resources: `this.then.undo(() => clearTimeout(timer))`. Recorded as `then`.

Mixing them throws `then() takes called steps or step references, not both.`; a bare step method throws - call it: `this.release(hold)`.

- An undo runs on any unwind passing through its step: the step's own failure after registering it, a later failure caught by a `.catch` whose branch includes the step, the run failing, `stop({ undo: true })`. Never on success.
- Steps it runs keep their own signatures and run as part of the unwind, with what they schedule and groups, before older undos. They reach `before`/`after`, so a log shows them; they are taken back by nothing.
- Registration is synchronous, anywhere in the body, any number. A step's undos run newest first.
- Registered before its step fails, an undo runs for that failure too and sees the step's partial writes - restored after it.
- It runs before fields are restored, so it reads the state as the run left it. Keys it, or a step it runs, writes are kept.
- It never recovers - the failure goes on. A step it runs throwing fails the unwind there. `end`, gates and waits throw in it: `end() cannot run in an undo.`
- `run` registers none - `run cleans up in its tail - try/catch around await this.` Cleanup there is a [tail](runs.md#run-and-the-result).

Entry: `undo: [{ id: 'release#1', key: 'release', args: ['hold_sku'] }]` - a group node for several, `then` for a function. The steps it ran get their own entries. Ids are minted at registration, so an undo never run leaves a gap.

## The unwind

A step that throws, breaks a rule, or returns a value fails the run:

1. Status `failed`, `error` set; pending steps are discarded, open waits released, in-flight steps' [signals](steps.md#the-step-signal) aborted; the failing step's own writes are restored, unless it is [irreversible](#irreversible) or [committed](#commit).
2. Steps still in flight - parallel members - settle; their commits are recorded.
3. Every committed entry, newest first, runs its undos; a failed step that registered some runs them too.
4. An undo that throws: `unwound: 'failed'`, `error` replaced by what it threw, the unwind stops there.
5. An `irreversible` or `committed` entry stops the unwind: `halted: true` ([Collections](#collections), [Commit](#commit)).
6. Fields and collection changes of every step taken back are restored - to their values before the earliest such step wrote them - except keys an undo wrote. Each taken-back entry that had undos or wrote is marked `unwound: true`.
7. `await this` in `run` rejects with `error` - the tail runs on the restored fields ([runs.md](runs.md#run-and-the-result)); without one, the run rejects with `error`.

`run`'s own writes are never restored - it is the entry, not a step to take back. `stop({ undo: true })` unwinds the same way with status `stopped`, undos given the `'Stopped'` error ([runs.md](runs.md#stop)). A [caught branch](catch.md) runs steps 3-6 over the branch only, and the run goes on.

## Keeping a value

A step's writes are restored whenever an unwind takes it back. To keep one past a failure:

- commit the step - [`this.then.commit()`](#commit) - when everything before it should stand too: an agent's reply, a captured charge;
- write it unmanaged - `this.is.notice = …`, or in a `_` helper, which runs on `this.is`;
- write it in an undo or a [catch handler](catch.md) - their keys are kept;
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
- Changes not through a step's wrapper are unmanaged - from outside, through `this.is`, in `_` helpers, or through a wrapper kept after its step settled. A kept wrapper hands a change to the step's [inline arrow](steps.md#inline-steps) in flight, as the step's proxy does.

### Irreversible

Some changes cannot be put back: a pool member removed by `delete` or `clear`, and a map value destroyed when removed or replaced (an owned `Model`) - unless the step added it itself. Detected per step, through its wrapper; a member destroyed directly is unmanaged. A step making one without registering an undo is irreversible: its entry carries `irreversible: ['<field>', …]`.

- The unwind stops at the first irreversible entry, newest first. Entries after it are taken back; it and every entry before it stay applied; it gets `halted: true`; `error` stays the original failure. `console.warn` names it once: `<instance> stopped unwinding at drop#1: items cannot be restored.`
- A failing step that made one keeps its writes - fields included - and is journaled with `error` and `irreversible`, so the unwind halts there.
- An irreversible step's failure is not caught ([catch.md](catch.md)).
- A step registering an undo is reversible: the unwind runs it, then restores what can be restored.

A map restores through its own `set(key, value)`: a factory map (`map((key) => …)`) passes the old value to its factory, so only keys the step added are restored exactly.

### Plain arrays and objects

`this.cart.items.push(x)` on a plain array or object is not observable - not journaled, not restored. Assign instead: `this.items = [...this.items, x]` is a field write.
