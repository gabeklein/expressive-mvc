# Examples

Five classes, each with mocked services and a test file read as a scenario walkthrough. Together they cover every shipped feature; comments mark the point a feature is used. Reading order: [order](order/order.ts) - the transaction: steps, groups, compensations, recovering from a typed failure with `.catch`; [agent](agent/agent.ts) - a long-lived instance whose steps commit, keeping what they wrote: runs that repeat and queue, waits answered from outside, steering; [deploy](deploy/deploy.ts) - the pipeline that uses the rest: retry with backoff, watchers, `commit`, compensations by step and args, hooks, cleanup in `run`'s tail; [crawl](crawl/crawl.ts) - many branches at once: `slot` with a live limit, `.catch` and `retry`, parallel writes to one `map`; [sync](sync/sync.ts) - composition: a class that cannot extend `Steps` holds one as a field. Shipped behavior is documented in [docs/](../docs/README.md).

A PR adding a feature extends an example and this table.

## Entry and runs

| feature | where |
| --- | --- |
| `run(...args)` as the entry - takes arguments, schedules, `await this`, returns the result | `Agent.run`, `SubmitOrder.run`, `Deploy.run`, `Crawl.run` |
| runs repeat, fields persist, `runs` | agent test `will keep messages across runs` |
| queue - `run()` mid-run, `then.queue` | agent test `will queue a prompt sent mid-turn` |
| `await instance` starts an idle run | order test `will run every step to end`, `Sync` |
| `await instance` joins an active run | agent test `will join a turn in progress` |
| idle await rejects when `run` takes args | agent test `will reject an idle await without a prompt` |
| `then.stop()` | agent test `will abort the model call when stopped mid-turn`, deploy test `will abort the test suite when stopped` |
| `then.stop(true)` | order test `will undo an order stopped mid-shipment` |
| `this.then.stop(true, reason)` - cancel and unwind from a step, the reason carried in the `'Stopped'` error | `Deploy.abort`; deploy test `will roll back the canaries and the build when the gate aborts` |
| `then.end()` from outside | agent test `will end a turn early from outside` |
| `set(null)` stops | agent test `will stop a turn when destroyed` |

## Steps

| feature | where |
| --- | --- |
| sequence, depth-first | `Deploy.run`, `Deploy.canary` (schedules `gate`, which runs before `migrate`) |
| variadic group `this.then(a, b)` | `SubmitOrder.pay` |
| mapped group `this.then(items, this.step)` | `Agent.turn`, `Deploy.canary`, `Crawl.run` |
| loop - a step scheduling itself | `Agent.turn`, `Pull.page` |
| loop - a plain `for` scheduling serially | `Deploy.rollout` |
| inline step `this.then(async (signal) => …)` | `Pull.page` |
| inline arrow - its writes are its own | `Pull.page` (`acked`); sync test `will pull every page and end with its values` |
| a pending `set<T>()` read waits | `Sync.token`, read by `Pull.page`; sync test `will wait for a token before pulling` |
| `_` helper - computes, the step assigns | `Deploy._spread`, `Deploy.canary` |
| `run`'s return typing the result | `SubmitOrder.run`, `Agent.run`, `Deploy.run`, `Crawl.run` |
| `this.then.end()` is terminal - runs at its place, the last call in its step | `SubmitOrder.pay`, `SubmitOrder.backorder` |
| `run` returning nothing - the plan drains, the result is `undefined` | `Sync`, sync test `will pull every page and end with its values` |

## Undo

| feature | where |
| --- | --- |
| `this.then.undo(this.step(x))` - a compensation: the step called for it, claimed, recorded with its args | `SubmitOrder.reserve` (`release`), `SubmitOrder.pay` (`refund`), `Deploy.install` (`uninstall`) |
| a step owning its compensation - undone when a sibling fails | `SubmitOrder.ship` (`cancel`); order test `will cancel the booking when the receipt fails` |
| several compensations in one step, newest first | `Deploy.build` |
| every step taken back has its fields restored | `SubmitOrder`, `Deploy.canary`; deploy test `will roll back the canaries and the build when the gate aborts` |
| a compensation per upgraded host, run when a later host fails | `Deploy.upgrade`; deploy test `will uninstall upgraded hosts when the rollout fails` |
| `this.then.commit()` - halts the unwind, keeping what came before | `Deploy.migrate`, `Agent.turn`, `Agent.exec`; agent test `will keep what a failing turn committed` |
| collection rollback - `has` list | `Agent.turn` (`draft`); agent test `will keep what a failing turn committed` |
| per-step attribution - parallel steps writing one `map` | `Crawl.scan`; crawl test `will retry a failing site with backoff, keeping what other sites found` |
| irreversible - pool deletion | `Deploy.retire`; deploy test `will stop unwinding at the retired release` |
| a typed failure handled where the plan recovers - `.catch(this.noCourier)`, a step method given the error, rethrowing what it does not know | `SubmitOrder.reserve`, `SubmitOrder.noCourier`; order test `will refund and backorder when no courier is free` |
| a note written in `run`'s tail, after the unwind | `SubmitOrder.run`; order test `will unwind what succeeded when a step fails` |

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
| `this.then.slot({ max })` - a group's concurrency, `max: ($) => $.limit` tracked live | `Crawl.visit`; crawl test `will scan at most limit sites at once, following a limit changed mid-run` |
| `this.then.slot({ after })` - backoff, a plain delay | `Deploy.test`, `Crawl.visit` (fake timers) |
| `.catch()` - skip a failing branch | `Crawl.run` (`report`); crawl test `will end even when the report fails` |
| `.catch(this.step)` - retry by re-running the issuing step, `this.then.retry`; the re-run queues for its slot again | `Deploy.test`; deploy test `will retry a flaky test suite with backoff` |
| `.catch(() => { this.visit(site); })` - a handler without parameters, recorded as the retry it calls; `(error) => …` for the skip that needs the error | `Crawl.visit`; crawl test `will retry a failing site with backoff, keeping what other sites found` |
| `.catch(() => { this.exec(call); })` - the caught step itself, once, recorded durably | `Agent.tool`, `Agent.allow`; agent test `will retry a tool, keeping what the tool pushed from outside` |
| a handler passing the error to a step - a group settling with what succeeded | `Crawl.skip`; crawl test `will skip a site after three retries` |

## Hooks, signal

| feature | where |
| --- | --- |
| `before` / `after` | `Deploy.before`, `Deploy.after` |
| cleanup in `run`'s tail | `Deploy.run` |
| a tail resetting a field on a failed run | `Pull.run`; sync test `will start over after a failed sync` |
| `this.then.signal`, aborted by `stop()` | `Agent.turn`, `Deploy.suite`, `Pull.page` |

## Runner surface

| member | where |
| --- | --- |
| `status`, `active` | order test `will expose progress as fields` |
| entries from `after` - `wrote`, no values; the runner keeps none | agent test `will keep what a failing turn committed`, order test `will name the fields each step wrote`; a log kept by `after` - `Checkout.log` on the [checkout page](../../../examples/pages/steps/checkout/App.tsx) |
| `waiting` | agent and deploy tests |
| `queue`, `runs` | agent tests |
| `error` | deploy test `will roll back the canaries and the build when the gate aborts` |
| `{ ...instance.then }` | order test `will snapshot the runner` |

## Recipes

| recipe | where |
| --- | --- |
| composition - a class that cannot extend `Steps` holds one as a field; the `Steps` model reaches its owner with `get()`, writes to it unmanaged | `Sync.pull`, `Pull.sync`, `Feed.known`; sync tests `will pull every page and end with its values`, `will start over after a failed sync` |
| steering mailbox - a `has()` list pulled by the loop | `Agent.steers`, `Agent.turn`; agent test `will pull steering sent mid-turn before ending` |
| steering by field - an outside write read by the next step | `Agent.tool` (`mode`); agent test `will steer later tool calls by writing mode` |
