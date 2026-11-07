# Runner - The Controller

`instance.then` is a `Steps.Runner`: an observable callable, not a Model. Named `then`, it makes the instance awaitable ([runs.md](runs.md#awaiting-the-instance---start-or-join)).

| member | |
| --- | --- |
| `status` | `'idle' \| 'running' \| 'waiting' \| 'stopped' \| 'failed'` - `idle` from construction and after a run ends |
| `active` | key of a step in flight, else `undefined`; with a group in flight, the latest invoked |
| `queue` | argument arrays of queued `run()` calls |
| `waiting` | open waits, `{ id, step, args, answers }`, oldest first ([wait.md](wait.md)) |
| `runs` | finished runs - ended, failed or stopped |
| `error` | what failed the run, or what a compensation threw |
| `on` | the instance |
| `end()` | in a step: end the run where the plan reaches it ([steps.md](steps.md#end-is-terminal)); outside: end the active run now ([runs.md](runs.md#end-from-outside)) |
| `stop(undo?, reason?)` | cancel ([runs.md](runs.md#stop)) |
| `commit()` | in a step: a point of no return ([undo.md](undo.md#commit)) |
| `catch(handler)` | in a step: register its compensation ([undo.md](undo.md#compensations)) |
| `reset()` | in a catch handler: restore the caught branch's fields now ([catch.md](catch.md)) |
| `slot({ max?, after?, key? })` | in a step: wait for a free slot, then run what follows holding it ([slot.md](slot.md)) |
| `signal` | in a step: its `AbortSignal` ([steps.md](steps.md#the-step-signal)) |
| `retry` | in a step: `0`, or how many times it was re-run from its own catch ([catch.md](catch.md#retry)) |
| `then(...tokens)`, `then(items, each)` | in a step: a parallel group ([steps.md](steps.md#parallel-groups)) |
| `then(fn)` | in a step: an inline step ([steps.md](steps.md#inline-steps)) |
| `then(...steps, ...watchers)` | in a step: a wait answered by one of these steps ([wait.md](wait.md)) |

## Entry

```ts
{ id, key, args, next, wrote, compensate?, unwound?, wake?, retry?, error?, irreversible?, committed?, halted? }
```

The Runner keeps no journal. Each step's entry is handed to `after(step, entry)` as it commits, a caught try's with `error` ([hooks.md](hooks.md)); a class wanting a log keeps them - `this.log.push(entry)`. A later unwind updates a kept entry in place: `unwound`, `halted` ([undo.md](undo.md#the-unwind)). See [steps.md](steps.md#entry).

`wrote` names the fields the step wrote, collections changed in place included - no values.

`commit`, `catch`, `reset`, `slot`, `signal` and `retry` outside a step throw.

`status`, `active`, `queue`, `waiting`, `runs` and `error` are enumerable getters: `{ ...order.then }` is a plain snapshot of them.

## Reactive

The members subscribe in a `get()` effect or a render, through the instance:

```ts
order.get((self) => {
  console.log(self.then.status, self.then.active);
});
// idle undefined → running run → running undefined → running reserve → … → idle undefined
```

`active` is `undefined` between steps.

```ts
const Status = () => {
  const { then } = SubmitOrder.get();

  return <p>{then.status} {then.active}</p>;
};
```

A tracking read of `then` is a callable view of the Runner: its members subscribe, and calling it joins as the instance's `then` does. mvc reserves `then` - it is not in `Object.keys(instance)` or `instance.get()`; `then.get()` snapshots the Runner.

Effects wait for the instance to be ready and, under a component, for the host to commit - the run does not: a `Steps` owned by a component not yet committed runs, and its watchers attach on commit.

## Steering

Writes from outside are allowed. They steer whichever step reads the field next and appear in no entry:

```ts
agent.mode = 'yolo';                   // the next tool() call reads it
```
