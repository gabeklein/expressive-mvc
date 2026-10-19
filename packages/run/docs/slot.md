# Slot - Concurrency and Delay

`this.then.slot({ max?, after?, key? })` inside a step is a token in the plan, like a step call. When the plan reaches it, it waits `after` ms, then queues FIFO for a slot - at most `max` held at once. Everything the step schedules after it runs behind it, holding the slot; once those items and their whole subtrees complete, the slot frees for the next in line. No `await`.

```ts
class Crawl extends Job {
  limit = 2;                                   // a UI may change it mid-run

  async next(sites: string[]) {
    this.then(sites, this.visit);
  }

  protected async visit(site: string) {
    this.then.slot({ max: () => this.limit }); // at most `limit` sites at once
    this.scan(site);                           // runs holding the slot
  }
}
```

- `max` - a number, or a function re-read whenever a slot frees and on any update of the job instance - `limit` above, raised or lowered live. Lowering it lets holders finish; nothing new starts until fewer are held. `0` pauses. Default: no limit, so `slot({ after })` alone is a delay. A function reading state elsewhere is re-read on the next release.
- `after` - milliseconds from reaching the slot before it queues (`setTimeout`). A backoff that does not block other waiters.
- `key` - which queue:
  - none - the enclosing group's: the nearest mapped or variadic group above the step, else the job instance's;
  - an object - typically a shared Model instance - one queue for every step using it, across groups and jobs: `max: 1` is a mutex, a pool size a semaphore;
  - any other value - one queue per value, across this job's groups and runs.
- A slot reached under a slot its own lineage holds in the same queue re-enters it: it waits `after`, takes no second slot, so a nested slot - or a [catch](catch.md) handler re-running its issuer, which keeps the slot through its `after` - cannot deadlock.
- `stop()`, an outside `end` or a failure releases the run's held slots and cancels its waiting ones; a [`back`](undo.md#back) cancels waiting slots it discards.

The token is journaled in the step's `next` - `{ id: 'slot#1', key: 'slot', args: [] }`; options are not journaled. A write after it fails the run as after any token. It cannot be grouped (`slot() cannot be grouped.`) or returned as an undo. Outside a step, `then.slot()` throws `slot must be called inside a step.`
