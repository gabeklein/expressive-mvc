# Job - The Contract

```ts
class Job extends Model {
  readonly then = run(this, { base: Job });
}
```

`Job` is a `Model` with `then = run(this, { base: Job })` built in - every subclass's methods are steps - and its hooks declared as optional members - subclasses get autocomplete, `override` catches a misspelling, a signature is checked by declaration. None is required.

| member | visibility | when it runs |
| --- | --- | --- |
| `then` | public, `readonly` | the `Runner` ([runner.md](runner.md)) - `await job` starts or joins a run ([runs.md](runs.md#awaiting-the-instance---start-or-join)) |
| `next(...args)` | public | the entry - starts a run, or queues one ([runs.md](runs.md)); narrow its parameters freely |
| `end(value?)` | `protected` | ends the run where the plan reaches it; its return types `await job`, else its argument, else the values dump ([steps.md](steps.md#end-is-terminal)) |
| `before(step, args, skip)` | `protected` | before each step ([hooks.md](hooks.md)) |
| `after(step, entry, skip)` | `protected` | after each step commits ([hooks.md](hooks.md)) |
| `back(reason)` | `protected` | once an unwind completes - after `then.back(step, reason)`, or a failure before the run rejects ([hooks.md](hooks.md#back)) |
| `exit(outcome)` | `protected` | once per run on every outcome - done, failed, stopped - last before it settles ([hooks.md](hooks.md#exit)) |

Other methods are steps, `protected async` by convention ([README.md](README.md#conventions)). Per-step `before<Step>`/`after<Step>` are checked at runtime only.

## Escape hatch: `run(this, options)`

For a class that cannot extend `Job` - it already extends another `Model` or a `Component`. The same runtime without the base class: the field holds the `Runner`. Hooks are found by name, `back` and `exit` included, and unchecked - or passed as options, typed. Prefer `Job` otherwise.

```ts
class Sync extends Remote {
  then = run(this, {
    exit(outcome) {
      if (outcome.status != 'done') this.cursor = '';
    }
  });
}
```

`Runner.Options<T>`:

| option | |
| --- | --- |
| `base` | opt into an extensible runner - the topmost class whose methods are steps and hooks, walked from the most-derived class; classes above it stay plain. Default: the most-derived class only. The instance must extend it, else `run` throws `<instance> does not extend <base>.` |
| `before`, `after`, `back`, `exit` | hooks typed against the instance, raw instance as `this`; each runs after the class's same-named hook ([hooks.md](hooks.md#hooks-as-options)) |

Without `base`, only the most-derived class's methods are steps and hooks - `Remote`'s stay plain, callable inline from a step and from outside. A subclass of `Sync` would get only its own methods as steps: a runner meant to be extended passes itself, `run(this, { base: Sync })`. `Job` passes `base: Job`.
