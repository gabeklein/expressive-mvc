# Examples

Five classes, each with mocked services and a test file read as a scenario walkthrough. Together they cover every shipped feature; comments mark the point a feature is used. Reading order: [order](order/order.ts) - the transaction: steps, groups, undo, `rewind`, failing forward with `back`; [agent](agent/agent.ts) - a long-lived instance on the light journal: runs that repeat and queue, waits answered from outside, steering; [deploy](deploy/deploy.ts) - the pipeline that uses the rest: retry with backoff, watchers, `commit`, undo by group and by wait, hooks, `exit`; [crawl](crawl/crawl.ts) - many branches at once: `slot` with a live limit, `.catch` and `attempt`, parallel writes to one `map`; [sync](sync/sync.ts) - `run(this, options)` on a class that cannot extend `Job`: steps from its own class only, a hook as an option. Shipped behavior is documented in [docs/](../docs/README.md).

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
| `then.stop(true)` | order test `will undo an order stopped mid-shipment` |
| `this.then.stop(true, reason)` - cancel and unwind from a step, the reason carried in the `'Stopped'` error | `Deploy.abort`; deploy test `will roll back the canaries and the build when the gate aborts` |
| `then.end(value)` from outside | agent test `will end a turn early from outside` |
| `set(null)` stops | agent test `will stop a turn when destroyed` |

## Steps

| feature | where |
| --- | --- |
| sequence, depth-first | `Deploy.next`, `Deploy.canary` (schedules `gate`, which runs before `migrate`) |
| variadic group `this.then(a, b)` | `SubmitOrder.pay` |
| mapped group `this.then(items, this.step)` | `Agent.turn`, `Deploy.canary`, `Crawl.next` |
| loop - a step scheduling itself | `Agent.turn`, `Sync.pull` |
| loop - a plain `for` scheduling serially | `Deploy.rollout` |
| inline step `this.then(async (signal) => …)` | `Sync.pull` |
| inline arrow - its writes in its own entry | `Sync.pull` (`acked`); sync test `will pull every page and end with its values` |
| a pending `set<T>()` read waits | `Sync.token`; sync test `will wait for a token before pulling` |
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
| collection rollback - `has` list | `Agent.turn` (`draft`); agent test `will keep what a failing turn committed` |
| per-step attribution - parallel steps writing one `map` | `Crawl.scan`; crawl test `will retry a failing site with backoff, keeping what other sites found` |
| irreversible - pool deletion | `Deploy.retire`; deploy test `will stop unwinding at the retired release` |
| `this.then.back(step, reason)` - unwind what committed after a step, discard what it scheduled, continue | `SubmitOrder.ship`; order test `will refund and backorder when no courier is free` |
| `back(reason)` - after any unwind: `back()`'s reason, else the error | `SubmitOrder.back`; order tests `will unwind what succeeded when a step fails`, `will refund and backorder when no courier is free` |

## Wait

| feature | where |
| --- | --- |
| answering steps present only while waited, reactive | `Agent.allow`; agent test `will offer allow only while a tool call waits` |
| routing by first argument | agent test `will answer the tool call it is given` |
| per-call Promise of an answer | agent test `will resolve allow once its tool has run` |
| watcher timeout with `signal` | `Agent.tool`, `Deploy.gate` |
| nudge - a watcher that does not answer | `Deploy.gate`; deploy test `will nudge on-call, then abort a gate nobody answers` |

## Slot and catch

| feature | where |
| --- | --- |
| `this.then.slot({ max })` - a group's concurrency, `max` read live | `Crawl.visit`; crawl test `will scan at most limit sites at once, following a limit changed mid-run` |
| `this.then.slot({ after })` - backoff, a plain delay | `Deploy.test`, `Crawl.visit` (fake timers) |
| `.catch()` - skip a failing branch | `Crawl.next` (`report`); crawl test `will end even when the report fails` |
| `.catch(this.step)` - retry by re-running the issuing step, `this.then.attempt` | `Deploy.test`, `Crawl.visit`; deploy test `will retry a flaky test suite with backoff` |
| `.catch(this.step)` - the caught step itself, once | `Agent.tool`, `Agent.allow`; agent test `will retry a tool, keeping what the tool pushed from outside` |
| `.catch(this.other)` with `this.then.caught` - a group settling with what succeeded | `Crawl.skip`; crawl test `will skip a site after three retries` |

## Hooks, signal

| feature | where |
| --- | --- |
| `before` / `after` | `Deploy.before`, `Deploy.after` |
| `before<Step>` / `after<Step>` with `skip` | `Deploy.beforeUpgrade`, `Deploy.afterUpgrade` |
| `exit(outcome)` | `Deploy.exit` |
| hook as an option - `run(this, { exit })` | `Sync`; sync test `will start over after a failed sync` |
| `this.then.signal`, aborted by `stop()` | `Agent.turn`, `Deploy.suite`, `Sync.pull` |

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
| `run(this)` on a class that cannot extend `Job` - steps from the instance's class only, a parent's methods plain | `Sync`, `Feed.known`; sync test `will pull every page and end with its values` |
| steering mailbox - a `has()` list pulled by the loop | `Agent.steers`, `Agent.turn`; agent test `will pull steering sent mid-turn before ending` |
| steering by field - an outside write read by the next step | `Agent.tool` (`mode`); agent test `will steer later tool calls by writing mode` |
