# @expressive/run

Durable, resumable runs built from `State` classes. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/run` is the trunk. Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Core fixes land on `main` as their own PRs - `fix/new-init` (`new()` read at activation, typed as an `Init`) is the first; the trunk is based on it.
- `packages/run/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A `Runner` instance is exactly one dispatch of actions: created to run, auto-started by `new()`, finished by `done`. Its methods are steps which hand off to one another; its fields carry the data between them. The record of a run - constructor args plus a journal of steps - is enough to rebuild an instance mid-swing, so instances are fungible: resume, retry, fork to debug and inspect are all one operation with a different cursor.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other, a run is a linked list, and resuming is "restore fields from the last commit, invoke the pending step with its journaled args".

## Agreed shape

- **`new()` is the entry point**, not a macro function. It receives the constructor args and hands off to the first step. It is public: TypeScript cannot read a protected member through a type parameter, and `Runner.new(...args)` types its arguments from it. A Runner's constructor arguments are its entry's arguments, not mvc's `Init`/`Assign` overlays.
- **Steps hand off, they do not return.** A call to a step from inside a running step is not a call: the runtime records it as the continuation and returns an inert token; the step's body settles. The next step is invoked after a clean settle only. A step that hands off and then throws has not handed off - commit is `{ step, args, patch, next }` on clean settle, so a failing step discards its handoff and its patch together.
- **Nothing in user code awaits a step.** A step's own promise is held by the runtime; `await this.next()` is a no-op. Enforcement: after a step has issued its handoff, a field write or another step call from it throws. A settle landing well after the handoff is a dev warning, not an error - a `finally` releasing a lock is legitimate trailing work.
- **A step that settles with no handoff** stalls the run at the top of the chain (an error, unless it called `wait`), or completes its branch inside a fork.
- **Data lives in fields and args.** Fields are run-scoped and durable; args are step-scoped and journaled. Both must survive structured clone. Any value reaching `done` flows through one or the other.
- **`done` is user-declared, Runner-managed** - like `render` in dom. Runner knows the name, enforces once-only and lets any step call it. Undeclared, it resolves the run with a dump of public values. Declared, `done(value: T)` types what steps pass and what the run resolves to (`ReturnType`, or `T` when void).
- **`then` is Runner's.** `await X.new(args)` resolves to the result; `X.new(args)` alone is the live instance. A user step named `then` fails at bootstrap. The only thenable-aware path in mvc is `set(fn)`'s factory output, so `task = X.new(args)` on another State holds the instance and `task = set(() => X.new(args))` suspends until the result.
- **Accumulators are handoffs**: `all(tokens, next)`, `race(tokens, next)`, `each(items, step, next)`. Branches run serially by default. A branch's value is whatever it wrote to fields; the join invokes `next` with no arguments. No `for`/`while` - a step calling itself is a loop and journals as one.
- **`wait` is a handoff, not an await.** It parks the run (or branch); the next step comes from outside - a public step called on the instance. That is waitForEvent with no event bus: the caller is the event, the method its handler. The runtime distinguishes who called only for the journal.
- **Outside writes are allowed and journaled** as their own entries, distinct from a step's patch - a steer is visible in the trace as an intervention, and resume stays faithful. `cancel()` is a steer read at the next handoff; the in-flight step completes and nothing follows. A read-only trap is not planned until a case demands it; `protected` is the convention.
- **`catch(error, step)`** follows `Component.catch`: a returned promise retries after it settles; a returned token redirects (compensation); throwing fails the run.
- **Core changes go upstream.** Build on `State.on({ type, setup, method, catch })` and `instance.set(cb)`: `type` wraps steps before they are bound, `setup` returning an overlay hydrates silently on resume. No internal imports - `@expressive/mvc` is a workspace peer.
- **Writes in `new` are not guarded.** mvc captures events during activation and replays them after, so a write in `new` reaches the listener after its handoff; every later step is guarded.
- **An unawaited failure throws uncaught** a macrotask later, as mvc's own reports do - a run nobody observes still fails loudly.
- **Serializability.** `has`/`map` children snapshot recursively; `get()` references re-resolve by context; `ref` and computed fields are skipped; `set(async)` factories on a Runner are journaled like steps.

## Benchmarks

Two classes drive design and tests. Order first.

```ts
class SubmitOrder extends Runner {
  cart: Cart;
  charge?: Charge = undefined;
  tracking = "";

  protected new(cart: Cart) {
    this.cart = cart;
    this.reserve();
  }

  async reserve() {
    await inventory.hold(this.cart.items);
    this.pay();
  }

  async pay() {
    const charge = await stripe.charge(this.cart.total);
    this.charge = charge;
    this.all([this.ship(charge.id), this.receipt(charge.receiptUrl)], this.done);
  }

  async ship(chargeId: string) { this.tracking = (await courier.book(this.cart, chargeId)).id; }
  async receipt(url: string) { await mail.send(this.cart.email, url); }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const result = await SubmitOrder.new(cart);
```

```ts
class Turn extends Runner {
  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages: Message[] = [];

  protected new(prompt: string) {
    this.messages = [user(prompt)];
    this.sample();
  }

  async sample() {
    const reply = await model.create({ messages: this.messages, tools });
    this.messages = [...this.messages, reply];

    const calls = toolCalls(reply);
    if (!calls.length) return this.done(reply);

    this.each(calls, this.tool, this.sample);
  }

  tool(call: ToolCall) {
    if (this.mode == 'ask' || this.mode == 'auto' && !safe(call))
      return this.wait(call);

    this.exec(call);
  }

  async exec(call: ToolCall) {
    this.messages = [...this.messages, result(call, await tools.run(call))];
  }

  allow(call: ToolCall) { this.exec(call); }
  deny(call: ToolCall) { this.messages = [...this.messages, result(call, 'denied')]; }

  done(reply: Message) {}
}
```

Turn exercises what Order does not: park and wake by outside call, steering (`turn.mode = 'yolo'` before the next `tool`), a run surviving restart while waiting on a human, and the journal as transcript.

## Plan

In order; stop and reassess after 2 if the journal is ugly.

- [x] **The loop** - `type` hook wrapping `new` and steps, tokens, settle-then-commit, post-handoff write guard, `done` / `then`. Order green with mocked stripe and courier. The journal is held but not yet readable.
- [ ] **Journal and resume** - `{ class, args, entries }`, `setup` overlay hydration, resume at the pending step, retry via `catch` returning a promise. Hand-off-then-throw discards both.
- [ ] **`all` / `each` / `wait` and outside steps** - Turn green, including park, restart, allow.
- [ ] **Steering entries, `race`, debug hooks** (`before(step)` parking a forked journal).

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent), persistence adapters.

**dev as a host**, after the MVP. The package stays generic - the loop needs nothing from a host, and the Turn benchmark is a browser case. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so `all({ parallel: true })` is a server capability; the walk's `key()` scoping a run to an identity. The record `{ class, args, journal }` and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.

## Open

- How the journal is read - a static (`Runner.journal(run)`), an instance getter, or only through resume. Public surface; decide with step 2.
- Attribution of concurrent branch writes when `all` runs parallel - disjoint fields by rule, last-write-wins logged, or serial only.
- Which `_`-prefixed convention excludes a field from the `done` dump, if any.
- Whether `done` returning void resolves with its argument or the dump when both exist.
