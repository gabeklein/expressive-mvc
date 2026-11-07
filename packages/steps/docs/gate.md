# Gate - Concurrency and Delay

`this.then({ max?, after?, key? })` inside a step - a plain object - is a gate: a token in the plan, like a step call. When the plan reaches it, it waits `after` ms, then queues FIFO for a slot - at most `max` held at once. Everything the step schedules after it runs behind it, holding the slot; once those items and their whole subtrees complete, the slot frees for the next in line. No `await`.

```ts
class Crawl extends Steps {
  limit = 2;                                   // a UI may change it mid-run

  async run(sites: string[]) {
    this.then(sites, this.visit);
  }

  protected async visit(site: string) {
    this.then({ max: ($) => $.limit });        // at most `limit` sites at once
    this.scan(site);                           // runs holding the slot
  }
}
```

- `max` - a number, or a function read live - `limit` above, raised or lowered mid-run. Lowering it lets holders finish; nothing new starts until fewer are held. `0` pauses. Default: no limit, so `this.then({ after })` alone is a delay.
  - `($) => …` - `$` is the instance's tracking proxy, as in `get(effect)`: re-read when anything read through it changes - `$.limit`, or `$.settings.limit` on a Model it holds. Tracked only while the gate waits, and read at once - not held until the instance is ready, as an effect is.
  - `() => …` - re-read when a slot frees and on any update of the instance. A closure over `this` or another Model refreshes only then - prefer `$`.
- `after` - milliseconds from reaching the gate before it queues (`setTimeout`). A backoff that does not block other waiters.
- `key` - which queue:
  - none - the enclosing group's: the nearest mapped or variadic group above the step, else the instance's;
  - an object - typically a shared Model instance - one queue for every step using it, across groups and instances: `max: 1` is a mutex, a pool size a semaphore;
  - any other value - one queue per value, across this instance's groups and runs.
- A gate reached under a slot its own lineage holds in the same queue, while the holder is in progress, re-enters it: it waits `after` and takes no second slot, so nested gates cannot deadlock.
- A [replay](catch.md#retry) queues again: the failed try's slots are released before it, so it waits its `after`, then queues behind those already waiting.
- `stop()`, an outside `end` or a failure releases the run's held slots and cancels its waiting ones; a [caught failure](catch.md) cancels waiting gates in its branch.

The token is journaled in the step's `next` as `{ id: 'gate#1', key: 'gate', args: [] }`; options are not journaled. A write after it fails the run as after any token. A gate stands alone - `this.then({ max }, this.a())` throws `then() takes a gate alone - this.then({ max, after, key }).` It cannot be grouped (`a gate cannot be grouped.`) or caught.
