# `Steps` - The Contract

```ts
class Steps extends Model {
  readonly then: Steps.Runner<this>;
}
```

`Steps` is a `Model` whose subclasses' methods are steps - every class from the instance's own up to `Steps`; `Model`'s stay plain. Its hooks are declared as optional members - subclasses get autocomplete, `override` catches a misspelling, a signature is checked by declaration. None is required. The class is the only contract: no function makes a Model runnable, and hooks are found on the class alone.

| member | visibility | when it runs |
| --- | --- | --- |
| `then` | public, `readonly` | the `Runner` ([runner.md](runner.md)) - `await instance` starts or joins a run ([runs.md](runs.md#awaiting-the-instance---start-or-join)) |
| `run(...args)` | public | the entry - starts a run, or queues one; `await this` inside it waits for the run, its return is the result ([runs.md](runs.md#run-and-the-result)); narrow its parameters freely |
| `before(step, args)` | `protected` | before each step ([hooks.md](hooks.md)) |
| `after(step, entry)` | `protected` | after each step commits ([hooks.md](hooks.md)) |
| `back(reason)` | `protected` | once an unwind completes - after `then.back(step, reason)`, or a failure before the run rejects ([hooks.md](hooks.md#back)) |

Other methods are steps, `protected async` by convention ([README.md](README.md#conventions)).

## Composition

A class that already extends another `Model`, or a `Component`, holds a `Steps` model as a field - owned like any child Model, destroyed with its owner. It reaches its owner with `get()`:

```ts
class Sync extends Feed {
  token = set<string>();
  pull = new Pull();
}

class Pull extends Steps {
  sync = get(Sync);
  cursor = '';

  async run() {
    this.page();
  }

  protected async page() {
    const { sync } = this;
    const page = await api.page(this.cursor, { token: sync.token, signal: this.then.signal });

    sync.items.push(...page.items);
    this.cursor = page.next || this.cursor;

    if (page.next) this.page();
  }
}

await sync.pull;                       // starts or joins its run
sync.pull.then.status;                 // reactive, as on any Steps model
```

Writes to the owner are unmanaged - in no entry, not restored by its unwind; state that must come back lives on the `Steps` model. `get(Sync)` is a field, so it is in `get()`. A component renders its fields and Runner through the field: `const { pull } = this; pull.then.status`.
