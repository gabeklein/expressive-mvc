# @expressive/run

Durable, resumable runs built from `State` classes. Scope and agreed shape - update as decisions land.

## Workflow

- `feat/run` is the trunk. Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Core fixes land on `main` as their own PRs - `fix/new-init` (`new()` read when activation reaches it, an own non-enumerable method counting; `Promise<void>` return) is the first; the trunk is based on it.
- `packages/run/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A State with `run = run(this)` is exactly one dispatch of actions: created to run, auto-started by `new()`, finished by `done`. Its methods are steps which schedule one another; its fields carry the data between them. The `Runner` the instruction returns is the controller - status, journal, result, seams. The record of a run - its values plus a journal of steps - is enough to rebuild an instance mid-swing, so instances are fungible: resume, retry, fork to debug and inspect are all one operation with a different cursor.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other's work, a run is a plan of tokens, and resuming is "restore fields from the last commit, invoke the pending plan with its journaled args".

## Agreed shape

- **`run(this)` is the instruction, `Runner` the controller.** No base class - a State opts in with one field, as with `ref(this)`. The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched, so a class is unaffected outside the instances that opted in. The `Runner` is an observable callable, not a State - a function made observable with `event`/`touch` from `@expressive/mvc/observable`, as `map`/`has` are: `status`, `step`, `error`, `entries` (the journal) are reactive; `on` is the instance; `get()` is the record `{ status, step, error, entries }`; `done(value?)` ends the run; `then` resolves it - `await x.run`. No name on the user's class is reserved.
- **`new()` is the entry point**, not a macro function - `protected new()`, parameterless, mvc's own hook. It schedules the first step. mvc reads it when activation reaches it, so the own wrapper applies to the first instance (`fix/new-init`).
- **Inputs are fields.** `X.new({ cart })` assigns them as any State's constructor does, so they show in the dump, the journal, a twin and inspect, and construction and resume are one operation - an overlay, then `new()`. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it. Parameters on `new` were rejected: TypeScript cannot read a protected member through a type parameter.
- **A step body is a plan builder.** A step called from inside a running step does not run: it returns an inert thenable token, scheduled after the calling step settles cleanly. Tokens scheduled together are a fork - serial, in issue order, by default. `await this.a()` resolves immediately (an opaque handle) and records order only: a token depends on every token awaited before it was issued (`after: [...ids]`), so `await Promise.all([this.a(), this.b()])` joins. Loops are plain JS loops. A step that throws after scheduling has scheduled nothing - commit is `{ id, key, args, prior, patch, next }` on clean settle, so a failing step discards its tokens and its patch together.
- **The first step call ends the step's work.** After scheduling, a step may only schedule more, await tokens, and return. Enforced two ways: a write through the step's proxy after its first token fails the run; a settle landing later than a few microtasks (`SLACK`) after its last token event fails the run ("kept working after scheduling") - each token event re-arms, latest arm wins. A sync side effect after scheduling - a mailer call - cannot be detected; side effects are steps. Documented discipline.
- **Each step runs with a proxy as `this`.** Writes through it are the entry's `patch`, with `prior` values recorded for the unwind; a token is attributed to the frame whose proxy issued it - so parallel branches attribute without `AsyncLocalStorage`. `this.is` is the real instance: a write through it, or from outside, is a steer (not journaled yet). Reads pass through; State's own methods bind to the instance.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, run inline with the calling step's proxy as `this`, part of its atomic unit. Every other method on the class, bases included, is a step; a step invoked inside a step is always scheduled, never called.
- **Return guard.** A step returns nothing, a function (its undo closure), or a token - `return this.release(id)` removes the token from the plan and journals it as a durable undo `{ key, args }`. Anything else fails the run. `done`'s return is its result, not an undo.
- **`done` joins.** It runs only when nothing else is pending. A class-declared `done(value)` is a step that types the result (`ReturnType`, or its argument when void); `runner.done(value?)` is the controller form - undeclared `done`, or an early end. When the plan drains with no `done`, the run ends implicitly with a dump of the class's public values, the `Runner` excluded. `done` scheduling a step, or scheduled twice, fails the run.
- **Rollback.** On failure: status `failed`, pending plan discarded, entries unwound in reverse commit order - run the undo (closure with the frame proxy as `this`; or the undo step), restore that entry's `prior` values, mark `undone: true`. An undo that throws marks `undone: 'failed'`, replaces `error`, stops the unwind. Undo frames cannot schedule steps - they hit the "is failed" guard. Then the result rejects; unawaited, it rethrows uncaught two microtasks later, as mvc's own reports do.
- **Outside calls.** A step called with no frame while one runs throws `<step> is running; <key> cannot be called from outside.`; after done or failed, `<instance> is <status>; <key> cannot run.`.
- **Data lives in fields and args.** Fields are run-scoped and durable; args are step-scoped and journaled. Both must survive structured clone. Any value reaching `done` flows through one or the other.
- **Seams** - user-definable on the class where they read as the class's business, config on `run(this, { ... })` where a host supplies them, class winning: `catch(error, step, attempt)` (a returned promise retries after it settles; a returned token redirects; throwing fails the run), `static retry = { attempts, backoff }`, `save(record)` (awaited before the next step - durability is "every commit awaited"), `wake(at)` (default `setTimeout`; a host persists `wakeAt` and resumes later). `run.resume(Type, record)` rebuilds: values overlay, then the pending plan. A host ships `const durable = (cfg) => run(self, { save, wake, ...cfg })`.
- **`wait` is a token, not an await.** It parks the run (or branch); the next step comes from outside - a public step called on the instance. That is waitForEvent with no event bus: the caller is the event, the method its handler. The runtime distinguishes who called only for the journal.
- **Outside writes are allowed and journaled** as their own entries, distinct from a step's patch - a steer is visible in the trace as an intervention, and resume stays faithful. `cancel()` is a steer read at the next drain; the in-flight step completes and nothing follows.
- **Destroy is cancel, with rescue.** `set(null)` mid-run: the in-flight step settles, its entry commits flagged `cancelled` with its patch, `save` runs, nothing follows. End is not destroy: a finished run is inert and readable, and its owner or GC collects it.
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

  async ship(chargeId: string) { this.tracking = (await courier.book(this.cart, chargeId)).id; }
  async receipt(url: string) { await mail.send(this.cart.email, url); }
  async refund(chargeId: string) { await stripe.refund(chargeId); }

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
    if (!calls.length) {
      this.done(reply);
      return;
    }

    await Promise.all(calls.map((call) => this.tool(call)));
    this.sample();
  }

  tool(call: ToolCall) {
    if (this.mode == 'ask' || this.mode == 'auto' && !safe(call)) this.wait(call);
    else this.exec(call);
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

- [x] **The loop** - `run(this)` wrapping `new` and steps per instance (own, non-enumerable), proxy-bound frames, plan-builder tokens with `await` as order and `Promise.all` as join, settle-then-commit, write and lateness guards, return guard, `_` helpers, undo closures and returned-token undos, reverse unwind with `prior` restore, `done` joining and implicit end, `Runner` as observable callable with `on`/`get()`/`status`/`step`/`entries`/`error`/`done`/`then`. Order green with mocked services, including the unwind.
- [ ] **Record and resume** - `get()` extended with `pending` and values, `run.resume(Type, record)`, `save`/`wake` seams with defaults, retry via `catch` returning a promise and `static retry`, destroy-as-cancel with rescue.
- [ ] **`wait` and outside steps** - Turn green, including park, restart, allow.
- [ ] **Steering entries, parallel forks, debug hooks** (`before(step)` parking a forked journal).

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent), persistence adapters.

**dev as a host**, after the MVP. The package stays generic - the loop needs nothing from a host, and the Turn benchmark is a browser case. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so a parallel fork is a server capability; the walk's `key()` scoping a run to an identity. The record `{ class, args, journal }` and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.

## Open

- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `done` dump, if any.
- `run.done`'s argument is `unknown` inside the class body (a conditional over the polymorphic `this` cannot resolve there); the typed path is the class's own `done` step.
- A `wait` while closure undos are held should warn or fail - closures do not survive a resume; only returned-token undos `{ key, args }` do.
- The lateness guard sees token events only: a sync side effect after scheduling is invisible to it.
