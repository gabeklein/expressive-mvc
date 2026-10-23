# Runner - The Controller

`job.then` is a `Runner`: an observable callable, not a Model. Named `then`, it makes the instance awaitable ([runs.md](runs.md#awaiting-the-instance---start-or-join)).

| member | |
| --- | --- |
| `status` | `'idle' \| 'running' \| 'waiting' \| 'stopped' \| 'failed'` - `idle` from construction and after a run ends |
| `active` | key of a step in flight, else `undefined`; with a group in flight, the latest invoked |
| `queue` | argument arrays of queued `next()` calls |
| `waiting` | open waits, `{ id, step, args, answers }`, oldest first ([wait.md](wait.md)) |
| `runs` | finished runs - ended, failed or stopped |
| `error` | what failed the run, or what its last undo threw |
| `on` | the instance |
| `end(value?)` | in a step: end the run where the plan reaches it ([steps.md](steps.md#end-is-terminal)); outside: end the active run now ([runs.md](runs.md#end-from-outside)) |
| `stop(undo?, reason?)` | cancel ([runs.md](runs.md#stop)) |
| `commit()` | in a step: a point of no return ([undo.md](undo.md#commit)) |
| `slot({ max?, after?, key? })` | in a step: wait for a free slot, then run what follows holding it ([slot.md](slot.md)) |
| `back(step, reason?)` | in a step: unwind what committed after `step`, then continue ([undo.md](undo.md#back)) |
| `signal` | in a step: its `AbortSignal` ([steps.md](steps.md#the-step-signal)) |
| `retry` | in a step: `0`, or how many times it was re-run from its own catch ([catch.md](catch.md#retry)) |
| `caught` | in a catch handler: the error it handles ([catch.md](catch.md)) |
| `then(...tokens)`, `then(items, each)` | in a step: a parallel group ([steps.md](steps.md#parallel-groups)) |
| `then(fn)` | in a step: an inline step ([steps.md](steps.md#inline-steps)) |
| `then(...steps, ...watchers)` | in a step: a wait answered by one of these steps ([wait.md](wait.md)) |

## Entry

```ts
{ id, key, args, next, wrote, undo?, undone?, wake?, retry?, error?, irreversible?, committed?, halted?, reason? }
```

The Runner keeps no journal. Each step's entry is handed to `after(step, entry)` as it commits ([hooks.md](hooks.md)); a class wanting a log keeps them - `this.log.push(entry)`. A later unwind updates a kept entry in place: `undone`, `halted`, and `reason` when `stop(undo, reason)` halted a parked unwind there ([undo.md](undo.md#a-returned-wait)). See [steps.md](steps.md#entry).

`wrote` names the fields the step wrote, collections changed in place included - no values.

`commit`, `back`, `slot`, `signal`, `retry` and `caught` outside a step throw.

`status`, `active`, `queue`, `waiting`, `runs` and `error` are enumerable getters: `{ ...order.then }` is a plain snapshot of them.

## Reactive

The members subscribe in a `get()` effect or a render, through the instance:

```ts
order.get((self) => {
  console.log(self.then.status, self.then.active);
});
// idle undefined → running next → running undefined → running reserve → … → idle undefined
```

`active` is `undefined` between steps.

```ts
const Status = () => {
  const { then } = SubmitOrder.get();

  return <p>{then.status} {then.active}</p>;
};
```

A tracking read of `then` is an observable view - not callable, so not awaitable. `await` the instance outside tracking contexts; inside one, read its members. `instance.get()` exports the Runner itself under its field.

## Steering

Writes from outside are allowed. They steer whichever step reads the field next and appear in no entry:

```ts
agent.mode = 'yolo';                   // the next tool() call reads it
```
