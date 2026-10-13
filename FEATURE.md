# @expressive/run

Durable, resumable runs built from `State` classes. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/run` is the trunk. Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Core fixes land on `main` as their own PRs - `fix/new-init` (`new()` read when activation reaches it, an own non-enumerable method counting; `Promise<void>` return) is the first; the trunk is based on it.
- `packages/run/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A State with `run = run(this)` is exactly one dispatch of actions: created to run, auto-started by `new()`, finished by `done`. Its methods are steps which hand off to one another; its fields carry the data between them. The `Runner` the instruction returns is the controller - status, journal, result, seams. The record of a run - its values plus a journal of steps - is enough to rebuild an instance mid-swing, so instances are fungible: resume, retry, fork to debug and inspect are all one operation with a different cursor.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other, a run is a linked list, and resuming is "restore fields from the last commit, invoke the pending step with its journaled args".

## Agreed shape

- **`run(this)` is the instruction, `Runner` the controller.** No base class - a State opts in with one field, as with `ref(this)`. The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched, so a class is unaffected outside the instances that opted in. The `Runner` is an owned child State: `status`, `step`, `entries` (the journal), `error` are reactive and addressable with `get()`; `done(value?)` ends the run; `then` resolves it - `await x.run`. No name on the user's class is reserved.
- **`new()` is the entry point**, not a macro function - `protected new()`, parameterless, mvc's own hook. It hands off to the first step. mvc reads it when activation reaches it, so the own wrapper applies to the first instance (`fix/new-init`).
- **Inputs are fields.** `X.new({ cart })` assigns them as any State's constructor does, so they show in the dump, the journal, a twin and inspect, and construction and resume are one operation - an overlay, then `new()`. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it. Parameters on `new` were rejected: TypeScript cannot read a protected member through a type parameter.
- **Steps hand off, they do not return.** A call to a step from inside a running step is not a call: the runtime records it as the continuation and returns an inert token; the step's body settles. The next step is invoked after a clean settle only. A step that hands off and then throws has not handed off - commit is `{ key, args, patch, next }` on clean settle, so a failing step discards its handoff and its patch together.
- **Each step runs with a proxy as `this`.** Writes through it are the step's patch; a write after its handoff fails the run; a handoff is attributed to the frame whose proxy made it - so parallel branches attribute without `AsyncLocalStorage`. `this.is` is the real instance: a write through it, or from outside, is a steer (journaled as such later). Reads pass through.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, run inline with the calling step's proxy as `this`, part of its atomic unit. Every other method on the class, bases included, is a step; a step invoked inside a step is always a handoff, never a call. Tokens are not thenable: an `async` step's `return this.next()` would be adopted by the promise machinery and turn into a call.
- **Nothing in user code awaits a step.** A step's own promise is held by the runtime; `await this.next()` is a no-op. A settle landing well after the handoff is a dev warning, not an error - a `finally` releasing a lock is legitimate trailing work.
- **A step that settles with no handoff** stalls the run at the top of the chain (an error, unless it called `wait`), or completes its branch inside a fork.
- **Data lives in fields and args.** Fields are run-scoped and durable; args are step-scoped and journaled. Both must survive structured clone. Any value reaching `done` flows through one or the other.
- **`done`.** `run.done(value)` ends the run after the current step settles - any step may call it, once. A `done` method on the class is a step with the same effect and types the result (`ReturnType`, or its argument when void); neither declared, the result is a dump of the class's public values, the `Runner` excluded.
- **Seams** - user-definable on the class where they read as the class's business, config on `run(this, { ... })` where a host supplies them, class winning: `catch(error, step, attempt)` (a returned promise retries after it settles; a returned token redirects; throwing fails the run), `static retry = { attempts, backoff }`, `save(record)` (awaited before the next step - durability is "every commit awaited"), `wake(at)` (default `setTimeout`; a host persists `wakeAt` and resumes later). `run.resume(Type, record)` rebuilds: values overlay, then the pending step. A host ships `const durable = (cfg) => run(self, { save, wake, ...cfg })`.
- **Accumulators are handoffs**: `all(tokens, next)`, `race(tokens, next)`, `each(items, step, next)`. Branches run serially by default; `parallel: true` is sound anywhere, thanks to the proxy. A branch's value is whatever it wrote to fields; the join invokes `next` with no arguments. No `for`/`while` - a step calling itself is a loop and journals as one, keyed by ordinal.
- **`wait` is a handoff, not an await.** It parks the run (or branch); the next step comes from outside - a public step called on the instance. That is waitForEvent with no event bus: the caller is the event, the method its handler. The runtime distinguishes who called only for the journal. An outside call while a step is in flight throws.
- **Outside writes are allowed and journaled** as their own entries, distinct from a step's patch - a steer is visible in the trace as an intervention, and resume stays faithful. `cancel()` is a steer read at the next handoff; the in-flight step completes and nothing follows.
- **Destroy is cancel, with rescue.** `set(null)` mid-run: the in-flight step settles, its entry commits flagged `cancelled` with its patch, `save` runs, nothing follows. End is not destroy: a finished run is inert and readable, and its owner or GC collects it.
- **An unawaited failure throws uncaught** two microtasks later, as mvc's own reports do - a run nobody observes still fails loudly.
- **Core changes go upstream.** Public mvc API only - `@expressive/mvc` is a workspace peer.
- **Serializability.** `has`/`map` children snapshot recursively; `get()` references re-resolve by context; `ref` and computed fields are skipped; `set(async)` factories on a run are journaled like steps.

## Benchmarks

Two classes drive design and tests. Order first.

```ts
class SubmitOrder extends State {
  run = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = "";

  protected new() {
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

const order = SubmitOrder.new({ cart });
const result = await order.run;
```

```ts
class Turn extends State {
  run = run(this);

  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages: Message[] = [];

  prompt = '';

  protected new() {
    this.messages = [user(this.prompt)];
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

- [x] **The loop** - `run(this)` wrapping `new` and steps per instance, proxy-bound frames, tokens, settle-then-commit, post-handoff write guard, `_` helpers, `Runner` with `status`/`step`/`entries`/`error`, `done` / `then`. Order green with mocked stripe and courier.
- [ ] **Record and resume** - `record()` as `{ values, entries, pending }`, `run.resume(Type, record)`, `save`/`wake` seams with defaults, retry via `catch` returning a promise and `static retry`, destroy-as-cancel with rescue.
- [ ] **`all` / `each` / `wait` and outside steps** - Turn green, including park, restart, allow.
- [ ] **Steering entries, `race`, debug hooks** (`before(step)` parking a forked journal).

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent), persistence adapters.

**dev as a host**, after the MVP. The package stays generic - the loop needs nothing from a host, and the Turn benchmark is a browser case. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so `all({ parallel: true })` is a server capability; the walk's `key()` scoping a run to an identity. The record `{ class, args, journal }` and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.

## Open

- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `done` dump, if any.
- `run.done`'s argument is `unknown` inside the class body (a conditional over the polymorphic `this` cannot resolve there); the typed path is the class's own `done` step.
