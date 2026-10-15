# Runner - The Controller

`job.then` - or what `run(this)` returns - is a `Runner`: an observable callable, not a State. With `run(this)` the field name is the user's - `then` makes the instance awaitable ([runs.md](runs.md#awaiting-the-instance---start-or-join)), `run` keeps the controller at `x.run`.

| member | |
| --- | --- |
| `status` | `'idle' \| 'running' \| 'waiting' \| 'stopped' \| 'failed'` - `idle` from construction and after a run ends |
| `active` | key of a step in flight, else `undefined`; with a group in flight, the latest invoked |
| `record` | the current or last run's journal - one entry per settled step, in commit order |
| `queue` | argument arrays of queued `next()` calls |
| `waiting` | open waits, `{ id, step, args, answers }`, oldest first ([wait.md](wait.md)) |
| `runs` | finished runs - ended, failed or stopped |
| `error` | what failed the run, or what its last undo threw |
| `on` | the instance |
| `end(value?)` | in a step: end the run once everything else has settled ([steps.md](steps.md#end-joins)); outside: end the active run now ([runs.md](runs.md#end-from-outside)) |
| `stop({ undo? })` | cancel ([runs.md](runs.md#stop)) |
| `retry({ attempts, backoff? })` | in a step: retry it ([retry.md](retry.md)) |
| `commit()` | in a step: a point of no return ([undo.md](undo.md#commit)) |
| `signal` | in a step: its `AbortSignal` ([steps.md](steps.md#the-step-signal)) |
| `then(...tokens)`, `then(items, each)` | in a step: a parallel group ([steps.md](steps.md#parallel-groups)) |
| `then(fn)` | in a step: an inline step ([steps.md](steps.md#inline-steps)) |
| `then(...steps, ...watchers)` | in a step: a wait answered by one of these steps ([wait.md](wait.md)) |

## Entry

```ts
{ id, key, args, next, wrote, undo?, undone?, wake?, attempt?, error?, irreversible?, committed?, halted? }
```

`wrote` names the fields the step wrote, collections changed in place included - no values. With [`rewind`](undo.md#rewind), each entry also carries `prior` and `patch` - values before and after - for the unwind to restore. See [steps.md](steps.md#entry).

`retry`, `commit` and `signal` outside a step throw.

`status`, `active`, `record`, `queue`, `waiting`, `runs` and `error` are enumerable getters: `{ ...order.then }` is a plain snapshot of them. The Runner iterates `record`:

```ts
for (const entry of order.then) console.log(entry.id);
```

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
