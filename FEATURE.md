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

Long-running processes the Expressive way. A State with `then = run(this)` is runnable: `next()` starts a run, its methods are steps which schedule one another, its fields carry the data between them, `end` ends it. The `Runner` the instruction returns is the controller - status, journal, queue, waits, result. The journal - each step's args, patch and what it scheduled - makes a run legible mid-swing, and the undo it carries makes a run atomic.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other's work, a run is a plan of tokens, and each step commits its own patch.

## Agreed shape

Shipped behavior is documented in [packages/run/docs/](packages/run/docs/README.md); this list holds the decisions behind it and those not yet built.

- **`run(this)` is the instruction, `Runner` the controller.** No base class - a State opts in with one field, as with `ref(this)`. The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched. Getters, `new`, `_` helpers and hooks are not wrapped. The `Runner` is an observable callable, not a State - a function made observable with `event`/`touch` from `@expressive/mvc/observable`, as `map`/`has` are. No name on the user's class is reserved - the field name is the user's.
- **`next(...args)` is the entry.** User-declared, any parameters. From outside it is the only callable step: it starts a run and returns a Promise settling with it. Any other step reads `undefined` from outside unless an open wait accepts it; a held reference called otherwise throws (`<key> cannot be called from outside; call next() to run.`). Inside a step `this.next(x)` is an ordinary step call - how an agent loops. `new()` stays mvc's setup hook, unwrapped; no auto-start - a class wanting one writes `new() { this.next(); }`.
- **Runs repeat.** Each run has its own `record` and ids; fields persist; `runs` counts finished runs; a finished run returns status to `idle`, `stopped`/`failed` hold until the next run starts. `next()` while a run is active queues a run, FIFO, listed in `then.queue`; each call's Promise settles with its own run; a failure does not clear the queue.
- **`await instance` is start-or-join.** Idle with nothing queued, it calls `next()` with no arguments - or rejects (`<instance> is idle. next() takes arguments; call it to start a run.`) when `next.length > 0` - a TS-optional parameter counts, so it needs a default (`next(prompt = '')`) to start on an idle await; otherwise it joins - settling once the active run and the queue drain, with the last run's result. The thenable is always in the type: `Runner<T>` is `Runner.Controller<T> & Runner.Thenable<T>` for any `next`. `then = run(this)` is the primary form - `Promise.resolve(instance)` and a `set(async () => X.new())` factory resolve to the result. A tracking read of `then` is an observable view and not callable. `run = run(this)` keeps it `await x.run`.
- **Inputs are fields, or `next`'s arguments.** `X.new({ cart })` assigns fields as any State's constructor does, so they show in the dump, the journal, a twin and inspect. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it.
- **A step body is a plan builder.** A step called from inside a running step does not run: it returns an inert, non-thenable token, scheduled after the calling step settles cleanly. Tokens run in sequence, depth-first: each, with everything it schedules, before the next sibling. `this.then(tokens)` / `this.then(items, each)` makes one parallel group at that point - members run concurrently, the group completes when every member's subtree has. Commit is `{ id, key, args, prior, patch, next }` on clean settle; a step that throws has scheduled nothing.
- **`then` is overloaded by argument.** Inside a step: an iterable first is a group, `(items, mapper | step)` a mapped group, all arguments steps of this instance a wait; any other function or nothing - the thenable, `await this` included - fails: `a step cannot await its own run.` Outside a step, `then(f, r)` is the thenable and an iterable throws. Group and wait signatures carry a generic `this` parameter so the await check skips them; the instance stays awaitable when the thenable part is present.
- **The first step call ends the step's work.** After its first token, a step may only issue tokens, group them, and return. Enforced two ways: a write through the step's proxy after its first token fails the run; a settle landing later than a few microtasks (`SLACK`) after its last token event - issue or group - fails the run. A sync side effect after scheduling cannot be detected; side effects are steps. Documented discipline.
- **Each step runs with a proxy as `this`.** Writes through it are the entry's `patch`, with `prior` values recorded for the unwind; a token is attributed to the frame whose proxy issued it, so parallel members attribute without `AsyncLocalStorage`. Reads pass through; State's own methods bind to the instance. `this.is` is the real instance: a write through it, or from outside, is a steer - allowed, in no patch.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, called inline, run on the instance as mvc binds them - their writes are in no patch, pass the write guard and are not rolled back. A helper computes; the step assigns.
- **Steps are `protected async`** - opinionated convention, opt-out, applied in examples and docs. `next` and answering steps stay public; `end` and hooks are protected - `Runner.Result` reads `end` by indexed access, which sees protected members, and unwraps it with `Awaited`.
- **Return guard.** A step returns nothing, a function (its undo closure), or a token it issued - `return this.release(id)` removes the token from the plan and journals it as a durable undo `{ id, key, args }`. Anything else fails the run. `end`'s return is its result, not an undo.
- **`end` joins.** Class hook `end(value?)` and `this.then.end(value?)` mean the same: it runs once, after everything else in the run; its return, else its argument, else a dump of public values (the `Runner` excluded) is the result. A plan that drains without `end` ends with the dump. `end` scheduling a step, or scheduled twice, fails the run.
- **Rollback is all or nothing.** On failure: status `failed`, pending discarded, waits released, the failing step's own writes restored; in-flight members settle and commit; then every committed entry is unwound in reverse - its undo if any (closure with a proxy as `this`, or the undo step with its journaled args), then its `prior` restored, `undone: true`. An undo that throws marks `undone: 'failed'`, replaces `error`, stops the unwind. Undo frames cannot schedule. Then the result rejects; unawaited, it rethrows uncaught two microtasks later.
- **`then.end(value?)` from outside ends early.** Pending discarded (not journaled), waits released, in-flight steps settle and commit, then `end` runs with `value` and the run resolves as a normal end - nothing undone; the queue proceeds. Idle, or already ending/halted, it does nothing. An in-flight failure meanwhile still fails the run.
- **`stop({ undo? })` cancels.** Pending discarded, waits released, in-flight steps settle and commit but schedule nothing, status `stopped`, queue cleared with each queued Promise rejecting with an error named `'Stopped'`, the current run rejecting with it once in-flight steps settle. `undo: true` unwinds as a failure does. `set(null)` stops. Finishing never destroys the instance.
- **`this.then(...steps)` waits.** Step references, no array - a token parking that point in the plan, answered by any one of the listed steps; what follows runs after the answer's subtree. Journaled `{ id: 'wait#n', key: 'wait', args: [], answers }`; status `waiting`; `then.waiting` lists `{ id, step, args, answers }` - the opening step's key and args. `next`/`end` cannot answer. A wait reached while closure undos are held warns once per run - a job-tier constraint surfaced early.
- **Answering steps are present only while waited for.** Every step but `next` is an own non-enumerable getter: from outside it reads the step while an open wait in the current run accepts it, else `undefined`; the read `touch`es its key and a change in the accepted set emits `event(instance, key)`. Inside a step every step reads through the proxy as usual. The declared type stays non-optional. An outside call answers the open wait whose opening step's first argument is `===` its own, else the oldest accepting it - journaled `wake: <id>`, run in the wait's place. It returns a Promise resolving when that step and its subtree complete (also when an outside `end` drops the subtree), rejecting with the run's error if it fails or stops first; awaiting it counts as awaiting the run. No buffering.
- **`this.then.retry({ attempts, backoff? })`** at the top of a step configures that step: on a throw from its body, fields restored to its `prior`, it runs again after `backoff(attempt)` ms, up to `attempts` tries. Each failed try is its own entry with `attempt` and `error`; the committed one carries `attempt` past the first. Rule violations do not retry; a stopped run does not retry. No class-level or static retry.
- **Hooks.** `before(key, args, skip)` / `after(key, entry, skip)` and per-step `before<Step>(skip, ...args)` / `after<Step>(skip, entry)`, excluded from wrapping by prefix (followed by an uppercase letter, or the bare name). Order: before → before<Step> → step → after<Step> → after; once per step, not per retry, not for undos. Raw instance as `this`, writes unjournaled, return ignored. `skip` is always false at this tier; the signature is shared with the job tier. A per-step hook without its step throws at construction.
- **Runner surface.** `status` (`idle | running | waiting | stopped | failed`), `active` (a step in flight, the latest invoked with a group), `record`, `queue`, `waiting`, `runs`, `error` - enumerable getters, so `{ ...instance.then }` is a snapshot; iterable over `record`; `on`; `end`, `stop`, `retry`; a non-enumerable `get()` snapshot.
- **Data lives in fields and args.** Fields persist across runs; args are step-scoped and journaled. Any value reaching `end` flows through one or the other.
- **Core changes go upstream.** Public mvc API only - `@expressive/mvc` is a workspace peer.

## Benchmarks

Two classes drive design and tests, both green: [SubmitOrder](packages/run/examples/order/order.ts) and [Agent](packages/run/examples/agent/agent.ts), each with mocked services.

```ts
class SubmitOrder extends State {
  then = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  async next() {
    this.reserve();
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then([this.ship(this.charge.id), this.receipt(this.charge.receiptUrl)]);
    this.end();

    return this.refund(this.charge.id);
  }

  protected async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  protected end() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}

const result = await SubmitOrder.new({ cart });
```

```ts
class Agent extends State {
  then = run(this);

  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();

  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages);

    this.messages.push(reply);

    const calls = toolCalls(reply);

    if (calls.length) {
      this.then(calls, this.tool);
      this.turn();
    }
    else this.end(reply);
  }

  protected async tool(call: ToolCall) {
    let allowed = this.mode === 'yolo';

    if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
    else this.then(this.allow, this.deny);
  }

  protected async exec(call: ToolCall) {
    this.messages.push(result(call, await tools.run(call)));
  }

  async allow(call: ToolCall) {
    this.exec(call);
  }

  async deny(call: ToolCall) {
    this.messages.push(result(call, 'denied'));
  }

  protected end(reply: Message) {
    return reply.content;
  }
}

const agent = Agent.new();

await agent.next('ship it');            // one turn
await agent.next('now the tests');      // the next - messages persist, then.runs == 2
```

Agent exercises what Order does not: a run per turn on one instance, a queue, park and wake by outside call (`allow`/`deny`), steering (`agent.mode = 'yolo'` before the next `tool`), and the journal as transcript.

## Plan

In order; stop and reassess after 2 if the journal is ugly.

- [x] **The loop** - `run(this)` wrapping steps per instance (own, non-enumerable), proxy-bound frames, plan-builder tokens, settle-then-commit, write and lateness guards, return guard, `_` helpers, undo closures and returned-token undos, reverse unwind with `prior` restore, joining end and implicit end, `Runner` as observable callable, `then = run(this)` making the instance awaitable. Order green with mocked services, including the unwind.
- [x] **Repeatable runs, hooks, wait, cancel** - Agent green.
  - [x] **`next()` is the entry**, runs repeat and queue; `await instance` is start-or-join; an idle await rejects when `next` takes arguments.
  - [x] **Depth-first sequence and parallel groups** - `this.then(tokens)`, `this.then(items, each)`; tokens non-thenable; `after`/await-order dropped.
  - [x] **`this.then.retry({ attempts, backoff })`** - per step, hooks not refired.
  - [x] **Hooks** - `before`/`after`, per-step `before<Step>`/`after<Step>`; orphans throw at runtime (type check: see Open).
  - [x] **`this.then.wait(context)`** - park, `then.waiting`, wake by outside call; closure-undo warning.
  - [x] **`stop({ undo })`**, `set(null)` stops.
  - [x] **Fixes** - rollback all or nothing; `_` helpers stay unmanaged, on the instance.
  - [x] **Renames** - `end` (was `done`), `active` (was `step`), `record` (was `entries`), status `idle` (was `done`).
- [x] **Waits name their answers** - `this.then(...steps)` replaces `then.wait`; answering steps present only while waited for, reactive; routing by first argument, else oldest; per-call Promise; `then.end()` from outside ends early.
- [ ] **Steering entries** - outside writes journaled as their own entries, distinct from a step's patch, so a steer is visible in the trace.
- [ ] **`this.then.sleep(ms)`** - in-process, warning like a wait when closure undos are held. Not built in step 2.

Held: recovery policy beyond per-step retry - a `catch` hook is not in the plan.

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent).

## Open

- Hook alignment by type is not enforced. `run(this)` in a field initializer infers the polymorphic `this`, and TS cannot relate `this` to a mapped type over it: `self: T & Aligned<T>` (a template-literal mapped type over `before${S}`/`after${S}` keys) rejects every class, aligned or not, and a conditional rest-parameter check stays deferred. A concrete check works only where the class type is concrete - e.g. an opt-in `class Agent extends State implements Runner.Hooks<Agent>` (new surface, not added). Shipped instead: a per-step hook without its step throws at construction; signatures are unchecked.
- `instance.get()` exports the Runner function itself under its field: mvc's `values()` duck-types `get()` only on objects, so the Runner's `get()` snapshot is not used there.
- Routing matches the first argument only; two waits opened with the same first argument are answered oldest first.
- Status is `waiting` while any wait is open, even with other members in flight.
- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `end` dump, if any.
- `this.then.end`'s argument is `unknown` inside the class body (a conditional over the polymorphic `this` cannot resolve there); the typed path is the class's own `end`. Likewise `next()`'s Promise is typed by the class's `next` declaration, not the run's result - await the instance for the typed result.
- The lateness guard sees token events only: a sync side effect after scheduling is invisible to it.
- Rollback covers field writes only - `has`/`map` mutations (`messages.push`) have no `prior`.

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
