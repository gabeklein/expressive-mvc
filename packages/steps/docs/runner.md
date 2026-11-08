# Runner - The Controller

`instance.then` is a `Steps.Runner`: an observable callable, not a Model. Named `then`, it makes the instance awaitable ([runs.md](runs.md#awaiting-the-instance---start-or-join)).

| member | |
| --- | --- |
| `status` | `'idle' \| 'running' \| 'waiting' \| 'stopped' \| 'aborted' \| 'failed'` - `idle` from construction and after a run ends |
| `active` | key of a step in flight, else `undefined`; with a group in flight, the latest invoked |
| `queue` | argument arrays of queued `run()` calls |
| `waiting` | open waits, `{ id, step, args, answers, until? }`, oldest first ([wait.md](wait.md)) |
| `runs` | finished runs - ended, failed, stopped or aborted |
| `error` | what failed the run, or what a handler threw |
| `self` | the instance |
| `end()` | in a step: end the run where the plan reaches it ([steps.md](steps.md#end-is-terminal)); outside: end the active run now ([runs.md](runs.md#end-from-outside)) |
| `stop(reason?)` | halt, keeping what was done ([runs.md](runs.md#stop-and-abort)) |
| `abort(reason?)` | halt and unwind ([runs.md](runs.md#stop-and-abort)) |
| `commit()` | in a step: a point of no return ([on.md](on.md#commit)) |
| `on({ reset, catch, abort, close })` | in a step: handlers for its subtree's outcomes ([on.md](on.md#handlers)) |
| `restore()` | in a catch handler: restore the caught branch's fields now ([catch.md](catch.md)) |
| `only(max, key?)` | in a step: a gate - wait for a free slot, then run what follows holding it ([gate.md](gate.md)) |
| `signal` | in a step: its `AbortSignal` ([steps.md](steps.md#the-step-signal)) |
| `retried` | in a step: how many times `retry()` replayed it - `0` on a first run ([catch.md](catch.md#retry)) |
| `retry()` | in a catch handler: replay what the catch is attached to ([catch.md](catch.md#retry)) |
| `then(...tokens)`, `then(items, each)` | in a step: a parallel group ([steps.md](steps.md#parallel-groups)) |
| `then(...steps, ...racers)` | in a step: a wait answered by one of these steps, raced by called ones ([wait.md](wait.md)) |
| `then({ ms, sec, min, hr, day })` | in a step: a duration ([wait.md](wait.md#durations)) |

## Entry

```ts
{ id, key, args, next, wrote, on?, unwound?, wake?, retried?, error?, irreversible?, committed?, halted?, implicit? }
```

The Runner keeps no journal. Each step's entry is handed to `after(step, entry)` as it commits, a caught try's with `error` ([hooks.md](hooks.md)); a class wanting a log keeps them - `this.log.push(entry)`. A later unwind updates a kept entry in place: `unwound`, `halted` ([on.md](on.md#the-unwind)). See [steps.md](steps.md#entry).

`wrote` names the fields the step wrote, collections changed in place included - no values.

`commit`, `on`, `restore`, `retry`, `only`, `signal` and `retried` outside a step throw; so does `then(steps)`.

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

Effects wait for the instance to be ready and, under a component, for the host to commit - the run does not: a `Steps` owned by a component not yet committed runs, and its effects attach on commit.

## Steering

Writes from outside are allowed. They steer whichever step reads the field next and appear in no entry:

```ts
agent.mode = 'yolo';                   // the next tool() call reads it
```
