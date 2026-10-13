# @expressive/run

Runs built from `State` classes. Scope and agreed shape - update as decisions land.

Two tiers. A **runnable** - `run(this)` - is atomic: single process, all or nothing with undo closures, an in-memory journal, repeatable. A **job** - later, a `Job` class with a preconfigured `run` and a tighter contract - is a resumable sequence of runnables with checkpoints. The runnable is the base tier and the current work; the job tier is parked at the end of this file.

## Workflow

- `feat/run` is the trunk. Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Core fixes land on `main` as their own PRs - `fix/new-init` (`new()` read when activation reaches it, an own non-enumerable method counting; `Promise<void>` return) is the first; the trunk is based on it.
- `packages/run/docs/` is the LLM-facing documentation of shipped behavior and the review surface for intent. A PR that pivots behavior updates the docs in the same PR. FEATURE.md stays the agenda. Root `skills/` will later be assembled per module from such folders.
- `packages/run/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A State with `then = run(this)` is one dispatch of actions: its methods are steps which schedule one another, its fields carry the data between them, `done` ends it. The `Runner` the instruction returns is the controller - status, journal, result, seams. The journal - each step's args, patch and what it scheduled - makes a run legible mid-swing, and the undo it carries makes a run atomic.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other's work, a run is a plan of tokens, and each step commits its own patch.

## Agreed shape

Shipped behavior is documented in [packages/run/docs/](packages/run/docs/README.md); this list holds the decisions behind it and those not yet built.

- **`run(this)` is the instruction, `Runner` the controller.** No base class - a State opts in with one field, as with `ref(this)`. The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched. The `Runner` is an observable callable, not a State - a function made observable with `event`/`touch` from `@expressive/mvc/observable`, as `map`/`has` are. No name on the user's class is reserved - the field name is the user's.
- **`then = run(this)` is the primary form** - the instance is awaitable; `Promise.resolve(instance)` and a `set(async () => X.new())` factory resolve to the result. A tracking read of `then` (render, `get()` effect) is an observable view and not callable, so `await` the instance outside tracking contexts. `run = run(this)` keeps it `await x.run`.
- **Entry.** `new()` schedules the first step today; step 2 moves the entry to `start()` so runs repeat (Plan). mvc reads `new` when activation reaches it, so the own wrapper applies to the first instance (`fix/new-init`).
- **Inputs are fields.** `X.new({ cart })` assigns them as any State's constructor does, so they show in the dump, the journal, a twin and inspect. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it. Parameters on the entry were rejected: TypeScript cannot read a protected member through a type parameter.
- **A step body is a plan builder.** A step called from inside a running step does not run: it returns an inert thenable token, scheduled after the calling step settles cleanly. Tokens scheduled together are a fork - serial, in issue order. `await this.a()` resolves immediately (an opaque handle) and records order only: a token depends on every token awaited before it was issued (`after: [...ids]`), so `await Promise.all([this.a(), this.b()])` joins. Loops are plain JS loops. Commit is `{ id, key, args, prior, patch, next }` on clean settle; a step that throws has scheduled nothing and journaled nothing.
- **The first step call ends the step's work.** After scheduling, a step may only schedule more, await tokens, and return. Enforced two ways: a write through the step's proxy after its first token fails the run; a settle landing later than a few microtasks (`SLACK`) after its last token event fails the run ("kept working after scheduling") - each token event re-arms, latest arm wins. A sync side effect after scheduling cannot be detected; side effects are steps. Documented discipline.
- **Each step runs with a proxy as `this`.** Writes through it are the entry's `patch`, with `prior` values recorded for the unwind; a token is attributed to the frame whose proxy issued it, so parallel branches attribute without `AsyncLocalStorage`. Reads pass through; State's own methods bind to the instance. `this.is` is the real instance: a write through it, or from outside, is a steer - allowed, in no patch.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, called inline, their result the step's. They bind to the instance, not the frame - a write inside one is not journaled. Every other method on the class, bases included, is a step; a step invoked inside a step is always scheduled, never called.
- **Return guard.** A step returns nothing, a function (its undo closure), or a token - `return this.release(id)` removes the token from the plan and journals it as a durable undo `{ key, args }`. Anything else fails the run. `done`'s return is its result, not an undo.
- **`done` joins.** It runs only when nothing else is pending. A class-declared `done(value)` is a step that types the result (`ReturnType`, or its argument when void); `this.then.done(value?)` is the controller form - undeclared `done`, or an early end. When the plan drains with no `done`, the run ends implicitly with a dump of the class's public values, the `Runner` excluded. `done` scheduling a step, or scheduled twice, fails the run.
- **Rollback.** On failure: status `failed`, pending plan discarded, entries with an undo unwound in reverse commit order - run the undo (closure with the frame proxy as `this`; or the undo step with its journaled args), restore that entry's `prior` values, mark `undone: true`. An entry without an undo keeps its patch. An undo that throws marks `undone: 'failed'`, replaces `error`, stops the unwind. Undo frames cannot schedule steps - they hit the "is failed" guard. Then the result rejects; unawaited, it rethrows uncaught two microtasks later, as mvc's own reports do.
- **Outside calls.** A step called with no frame while one runs throws `<step> is running; <key> cannot be called from outside.`; after done or failed, `<instance> is <status>; <key> cannot run.`. Step 2 adds `wait` as the one sanctioned outside call while a plan is pending.
- **Data lives in fields and args.** Fields are run-scoped; args are step-scoped and journaled. Any value reaching `done` flows through one or the other.
- **Core changes go upstream.** Public mvc API only - `@expressive/mvc` is a workspace peer.

## Benchmarks

Two classes drive design and tests. SubmitOrder is green on the shipped loop ([packages/run/examples/order/order.ts](packages/run/examples/order/order.ts)); Agent is the target for step 2 - it uses `start`, `wait` and repeatable runs, none of which has shipped.

```ts
class SubmitOrder extends State {
  then = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  protected new() {
    this.reserve();
  }

  async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.ship(this.charge.id);
    this.receipt(this.charge.receiptUrl);
    this.done();

    return this.refund(this.charge.id);
  }

  async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const order = SubmitOrder.new({ cart });
const result = await order;
```

```ts
class Agent extends State {
  then = run(this);

  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();

  prompt = '';

  start() {
    this.messages.push(user(this.prompt));
    this.turn();
  }

  async turn() {
    const reply = await model.create({ messages: [...this.messages], tools });

    this.messages.push(reply);

    const calls = toolCalls(reply);

    if (!calls.length) {
      this.done(reply);
      return;
    }

    await Promise.all(calls.map((call) => this.tool(call)));
    this.turn();
  }

  tool(call: ToolCall) {
    let allowed = this.mode === 'yolo';

    if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
    else this.then.wait(call);
  }

  async exec(call: ToolCall) {
    this.messages.push(result(call, await tools.run(call)));
  }

  allow(call: ToolCall) {
    this.exec(call);
  }

  deny(call: ToolCall) {
    this.messages.push(result(call, 'denied'));
  }

  done(reply: Message) {}
}

const agent = Agent.new();

agent.prompt = 'ship it';
await agent;                            // one turn

agent.prompt = 'now the tests';
await agent;                            // the next - messages persist, then.runs == 2
```

Agent exercises what Order does not: a run per turn on one instance, park and wake by outside call (`allow`/`deny`), steering (`agent.mode = 'yolo'` before the next `tool`), and the journal as transcript.

## Plan

In order; stop and reassess after 2 if the journal is ugly.

- [x] **The loop** - `run(this)` wrapping `new` and steps per instance (own, non-enumerable), proxy-bound frames, plan-builder tokens with `await` as order and `Promise.all` as join, settle-then-commit, write and lateness guards, return guard, `_` helpers, undo closures and returned-token undos, reverse unwind with `prior` restore, `done` joining and implicit end, `Runner` as observable callable with `on`/`get()`/`status`/`step`/`entries`/`error`/`done`/`then`, `then = run(this)` making the instance awaitable. Order green with mocked services, including the unwind.
- [ ] **Repeatable runs, hooks, wait, cancel** - Agent green.
  - [ ] **`start()` is the entry**, not `new()` - runs are repeatable. `then()` while idle starts a run and returns its promise; while running, joins it; after a run, the next `then()` starts a fresh run with its own journal. `then.runs` counts; instance fields persist across runs. `new()` stays free for setup. No auto-start.
  - [ ] **`this.then({ attempts, backoff })`** at the top of a step configures that step - granular retry only. On failure the node re-queues with `attempt + 1` after the backoff; retries do not fire before/after hooks. No class-level or static retry.
  - [ ] **Hooks** - `before(key, args, skip)` / `after(key, entry, skip)` and per-step `beforeShip(skip, ...args)` / `afterShip(skip, entry)`, excluded from wrapping by prefix. Alignment is enforced by the type of `run(this)`: a `beforeX` without a step `x`, or with a mismatched signature, fails to compile (template-literal mapped type). `skip` is always false at this tier; the signature is shared with the job tier.
  - [ ] **`this.then.wait(context)`** - a token holding its branch open until an outside step is called, the one allowed outside call while a plan is pending. `then.waiting` lists open waits with their context, reactive. `this.then.sleep(ms)` in-process. Both warn if closure undos are held - a job-tier concern surfaced early.
  - [ ] **Destroy is cancel.** `set(null)` mid-run: the in-flight step settles and commits, nothing follows, status `cancelled`. `then.cancel({ rollback: true })` unwinds. Finishing never destroys - a finished run is inert and readable.
- [ ] **Steering entries and parallel forks** - outside writes journaled as their own entries, distinct from a step's patch, so a steer is visible in the trace.

`then` is overloaded by position: `then(fn, fn)` is the thenable, `then({ ... })` inside a step is that step's config. A positional `then(args)` was considered and held.

Held: recovery policy beyond per-step retry - a `catch` hook is not in the plan.

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent).

## Open

- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `done` dump, if any.
- `this.then.done`'s argument is `unknown` inside the class body (a conditional over the polymorphic `this` cannot resolve there); the typed path is the class's own `done` step.
- The lateness guard sees token events only: a sync side effect after scheduling is invisible to it.

## Job tier (parked)

A `Job` is a resumable sequence of runnables with checkpoints - a `Job` class with a preconfigured `run` and a tighter contract. Nothing here is base-tier behavior.

- **Record.** `get()` extended with `pending` and values; `{ class, args, journal }` is enough to rebuild an instance mid-swing, so instances are fungible - resume, retry, fork to debug are one operation with a different cursor. Values must survive structured clone: `has`/`map` children snapshot recursively, `get()` references re-resolve by context, `ref` and computed fields are skipped, `set(async)` factories journaled like steps.
- **`save(record)` / `wake(at)`.** Seams on the class where they read as its business, config where a host supplies them, class winning. `save` is awaited before the next step - durability is "every commit awaited". `wake` defaults to `setTimeout`; a host persists `wakeAt` and resumes later.
- **`resume`.** `run.resume(Type, record)` rebuilds: values overlay, then the pending plan with its journaled args. Construction and resume are one operation - an overlay, then the entry.
- **Durable undo by returned token only.** Closures do not survive a resume; `{ key, args }` does. The base tier's `wait`/`sleep` warning is this constraint surfaced early.
- **Hydration hooks with `skip`.** `before`/`after` share the base-tier signature; `skip` is true when a step is being replayed from the record.
- **Slot form.** `run(Type, cfg)` - a host ships `const durable = (cfg) => run(self, { save, wake, ...cfg })`.
- **Persistence.** ORM-backed records; persistence adapters.
- **dev as a host.** The package stays generic. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so a parallel fork is a server capability; the walk's `key()` scoping a run to an identity. The record and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.
- **Destroy with rescue.** `set(null)` mid-run commits the in-flight entry flagged `cancelled` with its patch and runs `save` before stopping.
