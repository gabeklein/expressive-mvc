# Examples

Four classes, each with mocked services and a test file read as a scenario walkthrough. Together they cover every shipped feature; comments mark the point a feature is used. Reading order: [order](order/order.ts) - the transaction: steps, groups, undo, `rewind`; [agent](agent/agent.ts) - a long-lived instance on the light journal: runs that repeat and queue, waits answered from outside, steering; [deploy](deploy/deploy.ts) - the pipeline that uses the rest: retry, watchers, `commit`, undo by group and by wait, hooks, `exit`; [sync](sync/sync.ts) - `run(this, options)` on a class that cannot extend `Job`: `base`, a hook as an option. Shipped behavior is documented in [docs/](../docs/README.md).

A PR adding a feature extends an example and this table.

## Entry and runs

| feature | where |
| --- | --- |
| `next(...args)` as the entry | `Agent.next` |
| runs repeat, fields persist, `runs` | agent test `will keep messages across runs` |
| queue - `next()` mid-run, `then.queue` | agent test `will queue a prompt sent mid-turn` |
| `await instance` starts an idle run | order test `will run every step to end`, `Sync` |
| `await instance` joins an active run | agent test `will join a turn in progress` |
| idle await rejects when `next` takes args | agent test `will reject an idle await without a prompt` |
| `then.stop()` | agent test `will abort the model call when stopped mid-turn`, deploy test `will abort the test suite when stopped` |
| `then.stop({ undo: true })` | order test `will undo an order stopped mid-shipment` |
| `then.end(value)` from outside | agent test `will end a turn early from outside` |
| `set(null)` stops | agent test `will stop a turn when destroyed` |

## Steps

| feature | where |
| --- | --- |
| sequence, depth-first | `Deploy.next`, `Deploy.canary` (schedules `gate`, which runs before `migrate`) |
| variadic group `this.then(a, b)` | `SubmitOrder.pay` |
| mapped group `this.then(items, this.step)` | `Agent.turn`, `Deploy.canary` |
| loop - a step scheduling itself | `Agent.turn`, `Sync.pull` |
| loop - a plain `for` scheduling serially | `Deploy.rollout` |
| inline step `this.then(async (signal) => …)` | `Sync.pull` |
| inline step returned as a `void`-typed undo | `SubmitOrder.ship` |
| `_` helper - computes, the step assigns | `Deploy._spread`, `Deploy.canary` |
| `end` typing the result | `SubmitOrder.end`, `Agent.end`, `Deploy.end` |
| implicit end - the plan drains, the values dump | `Sync`, sync test `will pull every page and end with its values` |

## Undo

| feature | where |
| --- | --- |
| closure | `SubmitOrder.reserve` |
| returned step token | `SubmitOrder.pay` (`refund`), `Deploy.install` (`uninstall`) |
| returned group | `Deploy.build` |
| returned wait, with a watcher timeout | `Deploy.rollout`; deploy tests `will ask before reverting a failed rollout`, `will revert a failed rollout nobody answers` |
| `static readonly rewind = true` - `prior`/`patch` | `SubmitOrder`; order test `will keep what each step changed with rewind` |
| default light journal - `wrote` only | `Agent`, `Deploy`; agent test `will keep what a failing turn committed` |
| `this.then.commit()` | `Deploy.migrate`; deploy test `will ask before reverting a failed rollout` |
| collection rollback - `has` list | `Agent.turn` (`draft`), `Agent.exec` (retry); agent tests `will keep what a failing turn committed`, `will not repeat what a retried tool wrote` |
| irreversible - pool deletion | `Deploy.retire`; deploy test `will stop unwinding at the retired release` |
| `back(error)` | `SubmitOrder.back` |

## Wait

| feature | where |
| --- | --- |
| answering steps present only while waited, reactive | `Agent.allow`; agent test `will offer allow only while a tool call waits` |
| routing by first argument | agent test `will answer the tool call it is given` |
| per-call Promise of an answer | agent test `will resolve allow once its tool has run` |
| watcher timeout with `signal` | `Agent.tool`, `Deploy.gate` |
| nudge - a watcher that does not answer | `Deploy.gate`; deploy test `will nudge on-call, then abort a gate nobody answers` |
| an answer that throws fails the run | `Deploy.abort` |

## Retry, hooks, signal

| feature | where |
| --- | --- |
| `this.then.retry({ attempts, backoff })` | `Deploy.test` (fake timers), `Agent.exec` |
| `before` / `after` | `Deploy.before`, `Deploy.after` |
| `before<Step>` / `after<Step>` with `skip` | `Deploy.beforeUpgrade`, `Deploy.afterUpgrade` |
| `exit(outcome)` | `Deploy.exit` |
| hook as an option - `run(this, { exit })` | `Sync`; sync test `will start over after a failed sync` |
| `this.then.signal`, aborted by `stop()` | `Agent.turn`, `Deploy.test`, `Sync.pull` |

## Runner surface

| member | where |
| --- | --- |
| `status`, `active` | order test `will expose progress as fields` |
| `record` - `wrote` | agent test `will keep what a failing turn committed` |
| `record` - `prior` / `patch` | order test `will keep what each step changed with rewind` |
| `waiting` | agent and deploy tests |
| `queue`, `runs` | agent tests |
| `error` | deploy test `will roll back the canaries and the build when the gate aborts` |
| `{ ...instance.then }`, `for (const entry of instance.then)` | order test `will snapshot and iterate the runner` |

## Recipes

| recipe | where |
| --- | --- |
| `run(this, { base })` on a class that cannot extend `Job` - methods above `base` stay plain | `Sync`, `Feed.known`; sync test `will pull every page and end with its values` |
| steering mailbox - a `has()` list pulled by the loop | `Agent.steers`, `Agent.turn`; agent test `will pull steering sent mid-turn before ending` |
| steering by field - an outside write read by the next step | `Agent.tool` (`mode`); agent test `will steer later tool calls by writing mode` |
