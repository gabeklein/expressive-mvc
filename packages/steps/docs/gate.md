# Gate - Concurrency

`this.then.only(max, key?)` inside a step is a gate: a token in the plan, like a step call. When the plan reaches it, it queues FIFO for a slot - at most `max` held at once. Everything the step schedules after it runs behind it, holding the slot; once those items and their whole subtrees complete, the slot frees for the next in line. No `await`.

```ts
class Crawl extends Steps {
  limit = 2;                                   // a UI may change it mid-run

  async run(sites: string[]) {
    this.then(sites, this.visit);
  }

  protected async visit(site: string) {
    this.then.only(($) => $.limit);            // only `limit` sites at once
    this.scan(site);                           // runs holding the slot
  }
}
```

- `max` - a number, or a function read live - `limit` above, raised or lowered mid-run. Lowering it lets holders finish; nothing new starts until fewer are held. `0` pauses. Anything else throws `only() takes a count, or a function returning one.`
  - `($) => …` - `$` is the instance's tracking proxy, as in `get(effect)`: re-read when anything read through it changes - `$.limit`, or `$.settings.limit` on a Model it holds. Tracked only while the gate waits, and read at once - not held until the instance is ready, as an effect is.
  - `() => …` - re-read when a slot frees and on any update of the instance. A closure over `this` or another Model refreshes only then - prefer `$`.
- `key` - which queue:
  - none - the enclosing group's: the nearest mapped or variadic group above the step, else the instance's;
  - an object - typically a shared Model instance - one queue for every step using it, across groups and instances: `only(1, lock)` is a mutex, a pool size a semaphore;
  - any other value - one queue per value, across this instance's groups and runs.
- A gate reached under a slot its own lineage holds in the same queue, while the holder is in progress, re-enters it and takes no second slot, so nested gates cannot deadlock.
- A delay before queueing is a [duration](wait.md#durations) ahead of the gate: `if (this.then.retried) this.then({ sec: this.then.retried }); this.then.only(2);`.
- A [replay](catch.md#retry) queues again: the failed try's slots are released before it, so it queues behind those already waiting.
- `stop()`, `abort()`, an outside `end` or a failure releases the run's held slots and cancels its waiting ones; a [caught failure](catch.md) cancels waiting gates in its branch, a [lost race](wait.md#racers) releases its racers' slots.

```ts
class Render extends Steps {
  manager = get(JobManager);

  async run(body: RenderBody) {
    this.then.only(1, this.manager);           // one render per manager - a second queues
    this.start(body);
  }
}
```

The token is journaled in the step's `next` as `{ id: 'gate#1', key: 'gate', args: [] }`; `max` and `key` are not journaled. A write after it fails the run as after any token. `only` returns nothing - a gate cannot be grouped or caught - and outside a step throws `only must be called inside a step.`
