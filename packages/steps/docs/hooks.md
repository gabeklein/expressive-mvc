# Hooks - Before, After

Two names are hooks: `before` and `after` - found on the same classes as steps, the most-derived declaration winning: never wrapped, never scheduled - from outside they are plain methods. Any other name, `beforeShip` included, is a step.

```ts
protected before(key: string, args: unknown[]) {}
protected after(key: string, entry: Steps.Entry) {}
```

Order around each step: `before` → step → `after`. Work for one step belongs in the step, or a branch on `key`. The after hooks see the committed entry - the runner keeps none, so a log is built here ([runner.md](runner.md#entry)). A try a [catch](catch.md) took reaches them too, its entry carrying `error` - a log shows the attempt that failed beside its replacement - and so does the failure that ends the run.

Hooks are `protected` by convention ([README.md](README.md#conventions)) and synchronous. Hooks run with the raw instance as `this`: their writes are in no entry and do not count as step work; their return is ignored and not awaited. A hook that throws fails the run. Hooks fire for `run`, steps answering a wait, racers and function handlers (key `then`); once per step - a catch handler is its own step - and not for [resets](on.md#handlers).

`before`/`after` are declared on `Steps` - `override` checks their signatures ([contract.md](contract.md)).

## Cleanup

There is no outcome hook - cleanup on every outcome is `run`'s tail ([runs.md](runs.md#run-and-the-result)): `try`/`catch`/`finally` around `await this`, run after the unwind:

```ts
async run(id: string) {
  this.render(id);

  try {
    await this;
  } catch (error) {
    await rows.mark(id, this.then.status);   // 'failed' or 'stopped'
    throw error;
  } finally {
    this.preview.close();
  }
}
```

Two runs have no tail: one whose `run` never awaits `this` (the chained style), and one failing before `run` reaches `await this`. Put cleanup they need in the step that made the mess - its [reset](on.md#handlers).
