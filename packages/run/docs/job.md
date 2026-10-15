# Job - The Contract

```ts
class Job extends State {
  readonly then = run(this);
}
```

`Job` is a `State` with `then = run(this)` built in and its hooks declared as optional members - subclasses get autocomplete, `override` catches a misspelling, a signature is checked by declaration. None is required.

| member | visibility | when it runs |
| --- | --- | --- |
| `then` | public, `readonly` | the `Runner` ([runner.md](runner.md)) - `await job` starts or joins a run ([runs.md](runs.md#awaiting-the-instance---start-or-join)) |
| `next(...args)` | public | the entry - starts a run, or queues one ([runs.md](runs.md)); narrow its parameters freely |
| `end(value?)` | `protected` | last in a run; its return types `await job`, else its argument, else the values dump ([steps.md](steps.md#end-joins)) |
| `before(step, args, skip)` | `protected` | before each step ([hooks.md](hooks.md)) |
| `after(step, entry, skip)` | `protected` | after each step commits ([hooks.md](hooks.md)) |
| `back(error)` | `protected` | once an unwind completes, before the run rejects ([hooks.md](hooks.md#back)) |
| `exit(outcome)` | `protected` | once per run on every outcome - done, failed, stopped - last before it settles ([hooks.md](hooks.md#exit)) |
| `static rewind` | `static readonly` | `true`: entries keep `prior`/`patch` and the unwind restores committed steps' fields ([undo.md](undo.md#rewind)) |

Other methods are steps, `protected async` by convention ([README.md](README.md#conventions)). Per-step `before<Step>`/`after<Step>` are checked at runtime only.

## Options

A `Job` subclass configures its run with `static readonly` members. `Job` reads them from the subclass and passes them as `run(this, options)` - one config in two spellings.

```ts
class SubmitOrder extends Job {
  static readonly rewind = true;
}
```

| option | |
| --- | --- |
| `rewind` | keep `prior`/`patch` per entry; the unwind restores committed steps' fields ([undo.md](undo.md#rewind)) |

## Escape hatch: `run(this)`

For a class that cannot extend `Job` - it already extends another `State` or a `Component`. The same runtime without the base class: the field holds the `Runner`. Hooks are found by name, `back` and `exit` included; nothing is declared, so signatures are unchecked. Options are the second argument. Prefer `Job` otherwise.

```ts
class Sync extends Remote {
  then = run(this, { rewind: true });
}
```
