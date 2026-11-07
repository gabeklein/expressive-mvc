# @expressive/steps

Runs built from `Model` classes. Scope and agreed shape - update as decisions land.

Two tiers. A **runnable** - a `Steps` - is atomic: single process, all or nothing with compensations, repeatable. The **durable tier** - later, on the same `Steps` class - is a resumable sequence of runnables with checkpoints. The runnable is the base tier and the current work; the durable tier is parked at the end of this file.

## Workflow

- `feat/run` is the trunk (named before the package became `@expressive/steps`). Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Run depends only on published mvc behavior.
- `packages/steps/docs/` is the LLM-facing documentation of shipped behavior and the review surface for intent. A PR that pivots behavior updates the docs in the same PR. FEATURE.md stays the agenda. Root `skills/` will later be assembled per module from such folders.
- `packages/steps/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- Examples carry light learning comments - an exception to the no-comments rule - and together cover every shipped feature, mapped in [examples/README.md](packages/steps/examples/README.md); a PR adding a feature extends an example.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A `Steps` is a runnable Model: `run()` starts a run and returns its result, its methods are steps which schedule one another, its fields carry the data between them. The `Runner` at `then` is the controller - status, queue, waits. Each step's entry - its args, what it wrote and what it scheduled - is handed to `after` as it commits, so a run is legible mid-swing; the compensation a step registers makes it atomic.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other's work, a run is a plan of tokens, and each step commits its own patch.

## Agreed shape

Shipped behavior is documented in [packages/steps/docs/](packages/steps/docs/README.md); this list holds the decisions behind it and those not yet built.

- **The class is the only contract; `Runner` the controller.** `class X extends Steps` is the one way to make a Model runnable - no `run(this)` instruction, no options. `readonly then` built in (TS `readonly`), defined by `Steps`'s constructor as an own non-enumerable accessor - mvc reserves `then` (unmanaged, never overlaid, not in `get()`); the contract declared as optional members with JSDoc - public `run?(...args: any[]): Promise<unknown>` (a sync `run` is a type error), `before?(step, args)`, `after?(step, entry)` - so subclasses get autocomplete, `override` catches misspellings and signatures are checked by declaration; nothing is emitted on `Steps.prototype`. `run(prompt: string)` narrows freely (method bivariance). `x.run()` and `await instance` are typed by `run`'s return through `Steps.Result`; `then` is `Steps.Runner<this>`. Steps and hooks are found on every class from the instance's up to `Steps` - `Model`'s methods stay plain; a hook's most-derived declaration wins. Hooks live on the class only.
- **Composition replaces the escape hatch.** A class that already extends another `Model`, or a `Component`, holds a `Steps` model as a field (`pull = new Pull()`, as the checkout page's `checkout = new Checkout()`), which reaches its owner with `get(Owner)`. Writes to the owner are unmanaged. `run(this, options)` - `base`, `rewind`, hooks as options - left the API: one config in two spellings, and a second walk rule, for a case a field covers.
- **Coordination first.** A `Steps` class is the process's template: a step awaits the one call doing its work, then schedules, groups, gates or catches what follows. Work with its own state or more than a few lines lives in functions or Models the run owns, finds or reports to - learned porting a render job and a LoRA install, whose first-draft steps carried request building, stream handling and source selection inline. Reporting fields (progress, a status line) are ordinary managed fields written in steps; the UI subscribes. A failed or re-run try restores what it wrote - that try did not happen - and the handler or next step writes fresh values; a value that must outlive a failed try is written unmanaged - `this.is.x = …` or a `_` helper (mvc runs it on `this.is`) - or lives on an owned Model. No instruction marks a key unmanaged: the write site decides.
- **A `Steps` subclass configures its run through `static readonly` members** - none at this tier (`rewind` left: restoring is per step, by return); the durable tier adds `save`, `wake`, `strict`, declared with `declare static` so nothing is emitted on `Steps`.
- **The instruction.** The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched. Getters, `new`, `_` helpers and hooks are not wrapped - hooks stay plain methods, callable from outside. The `Runner` is an observable callable, not a Model - a function made observable with `event`/`touch` from `@expressive/mvc/observable`, as `map`/`has` are. Hook names aside (`before`, `after`), and `then`, no name on the user's class is reserved.
- **`run(...args)` is the entry.** User-declared, any parameters. From outside it is the only callable step: it starts a run and returns a Promise settling with it. Any other step reads `undefined` from outside unless an open wait accepts it; a held reference called otherwise throws (`<key> cannot be called from outside; call run() to run.`). Inside a step `this.run(x)` is an ordinary step call - how an agent loops. `new()` stays mvc's setup hook, unwrapped, possibly async; no auto-start - a class wanting one writes `new() { this.run(); }`. A pending `async new()` holds `ready` and effects, not runs.
- **Runs repeat.** Each run has its own ids; fields persist; `runs` counts finished runs; a finished run returns status to `idle`, `stopped`/`failed` hold until the next run starts. `run()` while a run is active queues a run, FIFO, listed in `then.queue`; each call's Promise settles with its own run; a failure does not clear the queue.
- **`await instance` is start-or-join.** Idle with nothing queued, it calls `run()` with no arguments - or rejects (`<instance> is idle. run() takes arguments; call it to start a run.`) when `run.length > 0` - a TS-optional parameter counts, so it needs a default (`run(prompt = '')`) to start on an idle await; otherwise it joins - settling once the active run and the queue drain, with the last run's result. The thenable is always in the type: `Steps.Runner<T>` is `Steps.Controller<T> & Steps.Thenable<T>` for any `run`. `then` is built into `Steps` - `Promise.resolve(instance)` and a `set(async () => X.new())` factory resolve to the result. A tracking read of `then` is a callable view - members subscribe, calling it joins.
- **Inputs are fields, or `run`'s arguments.** `X.new({ cart })` assigns fields as any Model's constructor does, so they show in the dump, the journal, a twin and inspect. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it.
- **A step body is a plan builder.** A step called from inside a running step does not run: it returns an inert, non-thenable token, scheduled after the calling step settles cleanly. Tokens run in sequence, depth-first: each, with everything it schedules, before the next sibling. `this.then(a, b)` / `this.then(items, each)` makes one parallel group at that point - variadic; `[]` is only the items of `then(items, each)` - members run concurrently, the group completes when every member's subtree has. Commit is `{ id, key, args, next, wrote }` on clean settle - no values; a step that throws has scheduled nothing.
- **`then` is overloaded by argument.** Inside a step: tokens are a group; `(items, mapper | step)` a mapped group; steps of this instance, plus plain functions as watchers, a wait; one plain function an inline step; tokens mixed with functions throw (`then() takes called steps or step references, not both.`); anything else - two functions, the thenable, `await this` included - fails: `a step cannot await its own run.` Outside a step, `then(f, r)` is the thenable and an object throws. In-step signatures return `Promise<void>`, as a step call does - so `.catch` is typed and a returned token keeps the step `Promise<void>` - and carry a generic `this` parameter so the await check skips them; the instance stays awaitable when the thenable part is present. A wait's watcher is typed `(signal: AbortSignal)` when it trails the steps (one or two).
- **The first step call ends the step's work.** After its first token, a step may only issue tokens, group them, and return. Enforced two ways: a write through the step's proxy after its first token fails the run; a settle landing later than a few microtasks (`SLACK`) after its last token event - issue or group - fails the run. A sync side effect after scheduling cannot be detected; side effects are steps. Documented discipline.
- **Each step runs with a proxy as `this`.** Writes through it are listed in the entry's `wrote`, their prior values held while the step is in flight so a throw or abort restores them; a token is attributed to the frame whose proxy issued it, so parallel members attribute without `AsyncLocalStorage`. Reads pass through; functions are returned as found - mvc already runs declared methods and `_` helpers on the instance, and `get`/`set` act on `this.is`. `this.is` is the real instance: a write through it, or from outside, is a steer - allowed, in no patch.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, called inline, run on the instance (mvc runs `_` methods unbound, on `this.is`) - their writes are in no patch, pass the write guard and are not rolled back. A helper computes; the step assigns.
- **Steps are `protected async`** - opinionated convention, opt-out, applied in examples and docs. `run` and answering steps stay public; hooks are protected.
- **Return guard.** A step returns nothing; any value fails the run (`<key> returned a value; a step returns nothing - its undo is this.then.catch(handler).`). Returned undos - closure, step token, group, inline step, wait, `true` - were removed before 0.1: the return slot meant two things (a returned step token undid, a called one scheduled), and compensation read poorly as a return. `run`'s return is the result.
- **Compensation is registered: `this.then.catch(handler, ...args)`.** Inside a step, synchronous, anywhere in the body, any number; not a token and not scheduling, so the first-call rule is untouched. `handler` is a step reference - durable: journaled as a node `{ id, key, args }` in `entry.compensate` - or a function (key `then`, not durable; a wait reached while one is held warns). It runs when an unwind takes the step back - a later failure caught above it, the run failing, `stop(true)` - and for the step's own failure once registered; given the error the unwind carries, then `args`. A step's compensations run newest first, before any field is restored, so they read the state as the run left it; keys they write are kept. Never recovers - the failure goes on; cannot schedule (`<key> is a compensation; <step> cannot run.`); no hooks. `run` registers none - its tail is its cleanup. Typed `catch<H extends Handler>(handler: H, ...args: Args<H>)`, where `Args<H>` is `never` unless the handler's first parameter is `unknown` or `any` - methods are bivariant, so the check is a conditional type. A returned wait parking the unwind until an operator answers has no equivalent: compensations cannot schedule, and a catch handler opening a wait runs after the branch's compensations - an operator choice before compensating is open.
- **Inline step.** One plain function, `this.then(() => ...)`, is an anonymous step journaled `then#n` (key `then`, `args: []`), run in its place as a full step frame - hooks with key `then` - given its frame's `AbortSignal` (what `this.then.signal` reads in a method step). Typed `Promise<void>` like a step call, so `return this.then(() => stripe.refund(id))` keeps a step `Promise<void>`. Not durable. A `function` gets its own proxy; an arrow's `this`, the enclosing step's settled proxy, hands writes, step calls and `this.then` to the inline frame - while it is that step's only inline frame in flight (nested ones walk up) and no wait that step opened is open. Otherwise the settled-proxy rule below holds.
- **`run` returns the result; `await this` inside it waits for the run.** The result is `run`'s return - one source for the type of `x.run()` and `await x`, no cast; the `end` hook and the values dump are gone (a class declaring `end` throws at construction). Before `await this`, `run` is an ordinary step: it takes arguments, writes fields and calls steps, committed as its entry, and what it scheduled starts there - the settle point. Awaiting anything else first fails the run (the lateness guard's check, with its blind spot: an await settling within a few microtasks slips through) - `run` does no work, so the durable tier can re-enter it without redoing any. After it, `run` is the tail: it reads fields and returns or throws; step calls throw, writes are unmanaged. `await this` resolves when the plan drains or `then.end()` drains it, rejects with the failure or `'Stopped'` after the unwind. The run settles with the tail's return or throw; `then.status`/`error` record the plan, so a tail catching a failure resolves the run while status stays `failed` - a handled rejection. Without `await this`, `run` settles at once and its return is the result (`void` for the chained style). `return await this` is circular (TS7023). `run` registers no compensation - an undo belongs to a step.
- **`then.end()` takes no value - one throws.** A token sequenced like any other, run at its place depth-first, or from outside now: pending discarded (not journaled), waits released, slots released or cancelled, in-flight steps aborted, settling and committing with what they schedule dropped; then `await this` resolves and the tail computes the result from fields. Any call after `end` in the same step - a second `end` included - fails the run (`end must be the last call in a step.`); registering a compensation is not a call. Two parallel `end`s: the first reached wins. Stop, failure and unwinds in progress keep precedence. Journaled `{ id: 'end#n', key: 'end', args: [], next: [], wrote: [] }`, `implicit: true` when the plan drained. A called `end` reaches `after` - a trace shows where a run was cut short (dropped by the spike, restored); an implicit one does not. Why a run ended early is domain data: the step calling `end` writes it to a field for `run`'s tail - no `then.cancelled` flag, and `end` never rejects (that is `stop(false, reason)`).
- **Every step is atomic; an unwind takes back every step it reaches.** An entry records `wrote: string[]` - no values. A frame holds prior values (fields, and inverses of its collection changes) while in flight, so a step that throws or is aborted restores its own partial writes; on commit the run keeps them until it ends - `run`'s excepted, as the entry is never taken back. On failure: status `failed`, pending discarded, waits released, in-flight signals aborted, the failing step's own writes restored; in-flight members settle and commit; then every committed entry, newest first, runs its compensations; then the fields of every entry taken back are restored to their values before the earliest of them wrote, except keys a compensation wrote. An entry that compensated or wrote is marked `unwound: true`. A compensation that throws marks `unwound: 'failed'`, replaces `error`, stops the unwind. Then the result rejects; unawaited, it rethrows uncaught two microtasks later. Restoring by default replaced opting in by return (`return true`): a transcript that must outlive a failure commits instead, and a value that must survive a failed try is written unmanaged, in a compensation or handler, or in the tail.
- **`this.then.commit()` is a deliberate point of no return.** Inside a step it marks the entry `committed: true` - a separate flag, so no field name is reserved in `irreversible`. From then the step's failure is not caught, a throw after it keeps its writes (journaled with `error`), and the unwind halts at it - `halted: true`, its compensations and everything before it not run - as at detected irreversibility, without the warning. Outside a step, or through a settled proxy, it throws.
- **`then.back` was removed before 0.1** - failing forward is a typed throw caught where the plan recovers: `this.pay().catch(this.noCourier)`, the handler checking `error instanceof NoCourier` and rethrowing the rest. Same unwind, no second mechanism, no `back` entry or hook.
- **`this.then.signal` is the step's `AbortSignal`.** Method steps have their own proxy as `this`, so it names the right frame. Aborted on `stop()`, an outside `end`, a failure elsewhere, and when the frame settles; the wait race is the watchers' (`signal` parameter). A step rejecting with its signal's `reason` after the runtime aborted it is no new failure: writes restored, nothing it scheduled runs, not caught, no entry. A different error thrown after the abort fails the run. Outside a step, reading it throws. Inline steps and watchers keep the parameter.
- **No outcome hook - cleanup is `run`'s tail.** `exit(outcome)` was removed before 0.1: `try`/`catch`/`finally` around `await this` covers done, failed and stopped, after the unwind and `back`, and `this.then.status` tells a stop from a failure. Two runs have no tail - a `run` without `await this`, and a failure before `run` reaches it; cleanup they need is the compensation of the step that made the mess.
- **`then.end()` from outside ends early** - the `end` token's own path, run now. Pending discarded (not journaled), waits released, in-flight signals aborted, in-flight steps settle and commit, then `run`'s `await this` resolves and its tail returns the result - nothing undone; the queue proceeds. Idle, or already ending/halted, it does nothing. An in-flight failure meanwhile still fails the run.
- **`stop(undo?, reason?)` cancels.** Pending discarded, waits released, in-flight signals aborted, in-flight steps settle and commit but schedule nothing, status `stopped`, queue cleared with each queued Promise rejecting with an error named `'Stopped'`, the current run rejecting with it once in-flight steps settle. `stop(true)` unwinds as a failure does, compensations given the `'Stopped'` error. `reason` is the `'Stopped'` error's `cause`, and its message when a string; the run, the queue, compensations and `run`'s tail see that one error; `then.error` stays unset. `set(null)` stops. Finishing never destroys the instance.
- **`this.then(...steps)` waits.** Step references, no array - a token parking that point in the plan, answered by any one of the listed steps; what follows runs after the answer's subtree. Plain functions among them are watchers (below). Journaled `{ id: 'wait#n', key: 'wait', args: [], answers }`; status `waiting`; `then.waiting` lists `{ id, step, args, answers }` - the opening step's key and args. `run`/`end` cannot answer. A wait reached while function compensations are held warns once per run - a durable-tier constraint surfaced early.
- **Answering steps are present only while waited for.** Every step but `run` is an own non-enumerable getter: from outside it reads the step while an open wait in the current run accepts it, else `undefined`; the read `touch`es its key and a change in the accepted set emits `event(instance, key)`. Inside a step every step reads through the proxy as usual. The declared type stays non-optional. An outside call answers the open wait whose opening step's first argument is `===` its own, else the oldest accepting it - journaled `wake: <id>`, run in the wait's place. It returns a Promise resolving when that step and its subtree complete (also when an outside `end` drops the subtree), rejecting with the run's error if it fails or stops first; awaiting it counts as awaiting the run. No buffering.
- **Watchers.** A plain (non-step) function in a wait's arguments starts when the plan reaches the wait, called on the opening step's proxy with an `AbortSignal` - a parameter, not `this.then.signal`, since an arrow's `this` is the enclosing step's proxy. The wait closes on its first answer - from outside or a watcher; then every watcher's signal aborts; `end`/`stop`/a failure close every open wait too. A watcher that settles without answering leaves the wait open - a nudge, not a decision. One that throws before the wait closes fails the run; a lost watcher's errors are discarded. Watchers are functions only, never tokens - their writes are unmanaged, like `_` helpers; in-process, not journaled.
- **A settled step's proxy calls from outside.** A call through a settled step's proxy - a watcher's arrow, a timer - is an outside call: nothing buffered, throws `<step> has settled; <key> cannot run.` when no open wait accepts it. It answers that step's own open wait first, else routes as any outside call; it is bound to its run - after that run ends every call through it throws, so a sleeping watcher cannot answer the next run's wait. Writes through it are unmanaged.
- **Collections a step changes are part of its unit, per frame.** A `has` list, `has` pool or `map` read through the step's proxy (detected by `instanceof has.List`/`has.Pool`/`map.Managed`, public classes) comes back as a per-frame wrapper - a Proxy whose mutators record an inverse for that frame, then forward; reads forward to the collection. The entry's `wrote` lists the field once the frame changed it. Restore - rollback, or an unwind - replays the frame's own inverses, newest first, so parallel siblings' changes stay: inserted values removed by identity at the nearest equal item, removed ones put back at their index, `set` reversed where its value now is, pool members the frame added deleted, map keys added deleted and changed ones set back; a value a sibling already removed or replaced is skipped. A change through the wrapper after the frame's first token fails the run, as a field write does. Changes not through a frame's wrapper - outside, `this.is`, helpers, a wrapper kept past its frame's settle - are unmanaged. A pool member removed, or a map value destroyed on removal or replacement, that the frame did not add itself cannot come back: without a compensation the entry is `irreversible: [field]`. An irreversible step's failure is not caught - its failing try is journaled with `irreversible` and keeps its writes; the unwind stops at the first irreversible entry, newest first, marking it `halted: true` with one `console.warn`; `error` stays the original. A compensation makes the step reversible: it runs, then what can be restored is. Plain arrays and objects mutated in place are not observable - assign instead.
- **`this.then.slot({ max?, after?, key? })` is a token.** Reached, it waits `after` ms (`setTimeout`), then queues FIFO for a slot under `max`; the frame's later items - and their subtrees - run holding it, then it frees for the next waiter. Scope: no `key` - the nearest mapped or variadic group above the frame (by the plan's parent chain), else the instance; an object key - one queue in a module `WeakMap`, across groups and instances; any other key - a per-`Runner` `Map`, so a primitive scopes to the instance. `max` is a number or a function - live from a UI; default unlimited, so `slot({ after })` alone is a delay; `0` pauses. `($) => $.limit` takes the instance's mvc tracking proxy and runs in a `watch` of the instance while the slot waits - not held for readiness, as a `get(effect)` is - so a change to anything read through `$` - nested Models included - re-pumps the queue; the effect is cancelled once the waiter is granted or cancelled. A zero-arg function is re-read on every release and on any update of the instance (an mvc `listener` while it waits) - a closure over another Model refreshes only then. A slot reached under a hold its own lineage has in the same queue, the holder still in progress, re-enters it without a second slot. `stop()`, an outside `end` and a failure release held slots and cancel waiting ones; a caught failure cancels the waiting ones in its branch. Journaled `{ id: 'slot#n', key: 'slot', args: [] }` in `run`. Not groupable, not caught; outside a step it throws.
- **A pending read waits.** A step throwing a `Promise` - mvc's suspense, from an unset `set<T>()` or a getter over one - restores its writes, drops its tokens and runs again from the top once it resolves: no entry, no hooks refired, no `retry` counted. A rejection is the try's error. `stop()`/an outside `end` meanwhile aborts it as its signal would. Past `commit()` or an irreversible change it fails as any throw.
- **`.catch(handler?, ...args)` on a token; `this.then.retry`, `this.then.reset()`.** Tokens share a prototype with `catch` and no `then`; `.catch` returns the same token, journaled with `rescue` (handler key, `then` for a function, `true` for none). The branch is the token's subtree by the plan's parent chain. A body throw in it - not a rule violation, not past `commit()` or irreversible, not an abort, not while stopping or ending - is caught by the nearest active caught token: the failing frame restored and journaled `{ id, key, args, next: [], wrote: [], error }`, the branch discarded (pending dropped, waits released, slots cancelled, in-flight aborted), its compensations run by the failure path's unwind - serialized across branches - then the handler runs in the branch's place. Handlers take the error first: a step reference runs given the error, then the failed token's args or `args` passed after the handler - except a step caught by itself, given the error in place of its first arg, so its own args are not shifted; a plain function runs as an inline step, the same way; `.catch()` skips. The handler's body sees the branch's failed state; once it returns, the branch's fields are restored except keys it wrote - their priors pass to the handler's entry, so a later unwind of it restores them to before the branch - then what it scheduled runs. `this.then.reset()` in a handler restores now (`reset() must be called in a .catch handler.` elsewhere). A handler recovers by scheduling, or throws to go on failing: the next caught token takes it, else the run fails; entries already taken back are not taken back twice. Typed through a `declare global` overload of `Promise.catch` - step calls are typed `Promise<void>` - matching only handlers whose args after the error are non-empty and whose error parameter is `unknown`/`any`, so ordinary `.catch(fn)` typing is untouched; a single-parameter handler typed `(error: Error)` still passes through `Promise`'s own overload. `then.caught` removed - the error is the first argument. `retry` counts re-runs - 0 on a step's first run, so `!this.then.retry` means it has not failed: one past the issuer's when the handler is the issuing step (`.catch(this.visit)` in `visit`), 1 when it is the caught step itself, else 0; an entry past 0 carries `retry`. A handler's parent is the caught token's, so slot scope and reentry follow the branch it replaces - except a handler re-running the issuer: the issuer's held slots are released before it starts, so the re-run waits its `after` and queues at the back. Slot and end tokens throw. A step that is also its own handler - a retry - takes the error first, and its ordinary calls pass `undefined` there: `this.visit(undefined, site)`.
- **Hooks.** Two names: `before(key, args)`, `after(key, entry)` - the base stays thin, extensions add more if they earn it. Per-step `before<Step>`/`after<Step>` were removed before 0.1: magic names, unchecked by types, one use across the examples and none in two dogfood ports - work for one step belongs in it, or a branch on `key`. The `back(reason)` hook left with `then.back`: a note on failure is written in `run`'s tail or a catch handler. Order: before → step → after; once per step - a catch handler is its own step - not for compensations. Raw instance as `this`, writes unjournaled, return ignored. No `skip` argument - replay is the durable tier's to add, as a trailing argument, if it needs one.
- **Runner surface.** `status` (`idle | running | waiting | stopped | failed`), `active` (a step in flight, the latest invoked with a group), `queue`, `waiting`, `runs`, `error` - enumerable getters, so `{ ...instance.then }` is a snapshot; `on`; `end`, `stop`, `commit`, `catch`, `reset`, `slot`, `signal`, `retry`; a non-enumerable `get()` snapshot.
- **The Runner keeps no journal.** Entries exist transiently: each committed step's is handed to `after(step, entry)` - a class wanting a log keeps them, and a later unwind updates a kept entry in place (`unwound`, `halted`). A try a catch took reaches `after` with `error` - a recipe or log shows the failed attempt beside its replacement. Entries the runtime makes for its own unwind - a failed try that kept its writes or registered compensations, an implicit `end` - reach no hook. Internally a run keeps its light entries (no values) for the unwind to walk, the compensation registry, and every step's priors - all dropped when the run ends. Record retention is not this package's concern: exhaustive logging and dashboards move to `@expressive/inspect` through an observation seam - designed next, generically for companion UIs, e.g. a `/__steps` page component droppable into a router.
- **Data lives in fields and args.** Fields persist across runs; args are step-scoped and journaled. Any value reaching `run`'s result flows through one or the other.
- **Core changes go upstream.** Public mvc API only - `@expressive/mvc` is a workspace peer.

## Benchmarks

Two classes drive design and tests, both green: [SubmitOrder](packages/steps/examples/order/order.ts) and [Agent](packages/steps/examples/agent/agent.ts), each with mocked services. [Deploy](packages/steps/examples/deploy/deploy.ts), [Sync](packages/steps/examples/sync/sync.ts) and [Crawl](packages/steps/examples/crawl/crawl.ts) cover the rest ([examples/README.md](packages/steps/examples/README.md)).

```ts
class SubmitOrder extends Steps {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';
  notice = '';

  async run() {
    this.reserve();
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.then.catch(this.release, hold);
    this.pay().catch(this.noCourier);
  }

  protected async noCourier(error: unknown) {
    if (!(error instanceof NoCourier)) throw error;

    this.notice = `Order ${this.cart.id} was not placed: no courier`;
    this.backorder();
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);
    this.then.catch(this.refund, this.charge.id);

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.then.end();
  }

  protected async ship(chargeId: string) {
    const booking = await courier.book(this.cart, chargeId);

    if (!booking) throw new NoCourier('no courier');

    this.tracking = booking.id;
    this.then.catch(this.cancel, booking.id);
  }

  // receipt, backorder, and the compensations release, refund, cancel - each one call
}

const result = await SubmitOrder.new({ cart });
```

```ts
class Agent extends Steps {
  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();
  draft = has<string>();

  async run(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages, {
      signal: this.then.signal,
      onChunk: (chunk) => this.draft.push(chunk)
    });

    this.draft.clear();
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

    if (allowed || this.mode === 'auto' && safe(call))
      this.exec(call).catch(this.exec);
    else
      this.then(this.allow, this.deny, async (signal) => {
        await delay(MINUTE, { signal });
        this.deny(call);
      });
  }

  protected async exec(call: ToolCall) {
    this.messages.push(result(call, await tools.run(call)));
  }

  async allow(call: ToolCall) {
    this.exec(call).catch(this.exec);
  }

  async deny(call: ToolCall) {
    this.messages.push(result(call, 'denied'));
  }

  protected end(reply: Message) {
    return reply.content;
  }
}

const agent = Agent.new();

await agent.run('ship it');            // one turn
await agent.run('now the tests');      // the next - messages persist, then.runs == 2
```

Order registers a compensation in every step that changes the world, and recovers from a typed `NoCourier` by catching it at `reserve`. Agent's steps commit what they push, and it exercises what Order does not: a run per turn on one instance, a queue, park and wake by outside call (`allow`/`deny`) or a timeout watcher, steering (`agent.mode = 'yolo'` before the next `tool`), a failing turn keeping what earlier steps pushed to `messages` while its own `draft` chunks are dropped, `stop()` mid-turn aborting the model call through `this.then.signal`.

A UI dogfood lives in the examples playground: [steps/checkout](examples/pages/steps/checkout/App.tsx) - cart → reserve → pay → approval wait with a timeout watcher → ship ∥ receipt → end, a decline thrown as a typed error, caught at `pay`, and a handler waiting on `pay` for another card - under a caught step, so a second decline loops, `stop(true)` - rendered on React and dom, with a Playwright spec.

## Crawler (benchmark)

A shopping UX scanning several sites at once, deduping products into one live list, driven by a user or an agent through an abstracted browser.

Principle: imperative seams that read tracked values when they run, over declarative config fixed before a run starts - a limit or a backoff may change live from a UI. Build blocks, not opinions. Agreed shape:

- **Per-frame collection attribution** - the correctness fix, first. A step reading a `has`/`map` through its proxy gets a per-frame wrapper: its mutators record an inverse for that frame, then forward to the collection; reads forward untouched. Rollback of a frame replays only its own inverses, newest first - parallel siblings untouched. A mutation through the wrapper after the frame's first token fails the run, as a field write does. Mutations not through a frame's wrapper (outside, `this.is`, helpers) are unmanaged. Irreversibility (a pool member removed, an owned map value destroyed) is detected per frame. Replaces the shared snapshot capture.
- **`this.then.slot({ max, after, key })`** - a plan token completing once a FIFO slot is free under `max` and `after` ms have passed since it was reached; what the frame schedules after it runs behind it and holds the slot until done. Scope: the enclosing group, else the instance; `key` shares one queue across groups and instances - a mutex at `max: 1`, a semaphore for a browser-context pool. `max` may be a function, re-read live. Covers the group concurrency limit, the cross-instance lock and the shared context pool; `slot({ after })` alone is a delay.
- **`.catch(handler?)` on tokens, `this.then.retry`** - branch-local recovery: a caught branch failing has its committed descendants unwound and the run continues - `.catch()` skips it (allSettled groups: `this.then(sites, (site) => this.visit(site).catch())`), `.catch(this.step)` runs a step in its place with the failed token's args, `.catch(fn)` an inline step given the error. `this.then.retry` counts a step re-run from its own catch. Replaces the `retry({ attempts, backoff })` config: retry is `.catch(this.step)` behind `this.then.retry`, backoff is `slot({ after })`.
- **Driving the run mid-flight, concurrency of parallel branches** - user construction, no new API: a mailbox `has()` pulled by a loop, handler steps answering waits, a `skipped` set checked at a step's top to drop a branch. Signals stay an engine detail.
- **Journal growth** - decided: the runner keeps only what unwinding needs; each committed entry is handed to `after(step, entry)` so a user builds their own flat log; `record` left the Runner, and `rewind` with it - every step's priors are kept until the run ends.

## Plan

In order; stop and reassess after 2 if the journal is ugly.

- [x] **The loop** - `run(this)` wrapping steps per instance (own, non-enumerable), proxy-bound frames, plan-builder tokens, settle-then-commit, write and lateness guards, return guard, `_` helpers, undo closures and returned-token undos, reverse unwind with `prior` restore, terminal end and implicit end, `Runner` as observable callable, `then = run(this)` making the instance awaitable. Order green with mocked services, including the unwind.
- [x] **Repeatable runs, hooks, wait, cancel** - Agent green.
  - [x] **`run()` is the entry**, runs repeat and queue; `await instance` is start-or-join; an idle await rejects when `run` takes arguments.
  - [x] **Depth-first sequence and parallel groups** - `this.then(tokens)`, `this.then(items, each)`; tokens non-thenable; `after`/await-order dropped.
  - [x] **`this.then.retry({ attempts, backoff })`** - per step, hooks not refired. Superseded by `.catch`; the name now counts re-runs (`this.then.retry`).
  - [x] **Hooks** - `before`/`after` (per-step hooks later removed).
  - [x] **`this.then.wait(context)`** - park, `then.waiting`, wake by outside call; closure-undo warning.
  - [x] **`stop(undo, reason)`**, `set(null)` stops.
  - [x] **Fixes** - rollback all or nothing; `_` helpers stay unmanaged, on the instance.
  - [x] **Renames** - `end` (was `done`), `active` (was `step`), `record` (was `entries`), status `idle` (was `done`).
- [x] **Waits name their answers** - `this.then(...steps)` replaces `then.wait`; answering steps present only while waited for, reactive; routing by first argument, else oldest; per-call Promise; `then.end()` from outside ends early.
- [x] **`Steps`** - Model base with `readonly then = run(this)` and the declared contract; `back` hook (also honored by `run(this)` classes). Examples extend it.
- [x] **Controllers** - the runtime rebuilt as mvc Models: `Control` per instance, `Run` per run, `Frame` per step, `Wait` per open wait; ownership and teardown are mvc's, one listener bridges `Control` to the `Runner`; control flow stays direct calls.
- [x] **Compensation and waits** - variadic groups, inline steps, watchers with `AbortSignal`, settled-proxy calls as outside calls, undo by any token kind (group, inline, wait parking the unwind). Agent tool approval times out by watcher.
- [x] **Lessons from agent-focus** - light journal (`wrote`) by default, `static readonly rewind` opt-in (the first `static readonly` option); `this.then.commit()`; `exit(outcome)`; `this.then.signal`. Agent streams a `draft` and aborts its model call on `stop()`.
- [x] **`this.then.back(step, reason?)`** - commanded unwind through the failure path's unwind; `back(reason)` hook; an answer's `commit()` declines a returned wait. Order fails forward to a backorder.
- [ ] **Crawler blocks** - in order:
  - [x] **Per-frame collection attribution** - wrapper per frame, inverse log, write guard over collections; snapshot capture removed.
  - [x] **`this.then.slot({ max, after, key })`** - group, instance and keyed queues; live `max`.
  - [x] **`.catch(handler?)` on tokens, `this.then.retry`** - branch unwind, handler in place; the `retry({ attempts, backoff })` config removed.
  - [x] **Crawl example** - slot, catch and retry together.
  - [x] **Decisions** - a retry of its issuer re-queues for its slot; `max: ($) => …` tracked across Models; `exit`'s throw reported, outcome kept; `back` hook once per unwind; a stop reason recorded on a parked unwind; implicit `end` journaled.
- [x] **Rewind by return** - a step keeps its priors by returning an undo or `true`; `static rewind` and the `rewind` option removed; `record` left the Runner - entries reach `after` only.
- [x] **The class is the only contract** - `run()` and `Runner.Options` left the public API; hooks on the class only; Sync composes a `Steps` model as a field.
- [x] **Renamed** - `@expressive/run` is `@expressive/steps`, `Job` is `Steps`; types under its namespace (`Steps.Runner`, `Steps.Entry`, `Steps.Outcome`, …). The trunk keeps its name, `feat/run`.
- [x] **The entry is `run`** - `next` renamed once it became the run's body: it takes the arguments, schedules, awaits the plan and returns the result; `this.run(x)` inside a step is the loop.
- [x] **Compensations registered, not returned** - `this.then.catch(handler, ...args)` replaces returned undos; `.catch` handlers take the error first, see the failed state and keep their writes, `then.reset()` restores early; every step taken back is restored; `then.back`, the `back` hook and `then.caught` removed. Entry `undo`/`undone` became `compensate`/`unwound`.
- [ ] **Steering entries** - outside writes journaled as their own entries, distinct from a step's patch, so a steer is visible in the trace.
- [ ] **`this.then.sleep(ms)`** - in-process, warning like a wait when function compensations are held. `slot({ after })` is the in-process delay meanwhile, without the warning; the durable form waits for the durable tier.

Later, on `Steps` - the durable tier: `save`/`load`/`wake`, a trailing replay flag on hooks if needed, child `Steps` models as plan items with checkpoints; options as `static readonly` members.

Held: a class-level `catch` hook - recovery is per token (`.catch`).

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent) - superseded by the held design below, child `Steps`s as plan items.

Learned from agent-focus (porting an ACP client: one long step awaiting `session/prompt` while transcript chunks stream into state) - not built:

- **Preempting `run`** - stop the current run, keep the queue, start the new one; today `run()` only queues and `stop()` clears the queue.
- **Run status in `instance.get()`** - decided against: `get()` exports the Model's data, run status is process state about it. A host serializing state reads `then.get()`; the durable tier's record carries status as the host seam.
- **Steering mailbox** - a `has()` list pulled by the loop; shipped as a docs recipe ([runs.md](packages/steps/docs/runs.md#steering---a-mailbox)), no API.
- **Step timeout** - via `this.then.signal`: an option aborting a step after `ms`, or `AbortSignal.any([this.then.signal, AbortSignal.timeout(ms)])` as a recipe.
- **Outside `fail(error)`** - fail the active run from outside (a transport error), unwinding as a step failure would; today only `stop(true)`.
- **Cross-instance lock** - two instances sharing one resource (a session) serialize - planned as `slot({ key, max: 1 })` ([Crawler](#crawler-benchmark)).
- **Interrupted-on-restart marker** - the durable tier marks a run found in flight at load as interrupted rather than replaying a step with side effects.
- **Child runs** - held design below.

Learned porting a server render job and a model-asset install - not built:

- **Unobserved runs on a server** - a server starting runs it does not await (a job id returned, progress over SSE) needs `.catch(() => {})` on each, or a failure is rethrown uncaught. With `exit` gone, a tail that catches and returns already settles the run as handled; a tail that rethrows still needs an observer. Open whether a run with a tail counts as observed.
- **Step reports** - both ports grew the same parts: a `progress` field and a recipe built in `after` (a `_` helper keeping progress through a failed try was dropped - restoring it is correct: that try did not happen). The shape worth upstream is not a Runner field but a per-step report: a value a step publishes while in flight - latest wins, never restored, attributed to its frame. It gives what a field cannot: observers (inspect, a `/__steps` page, a cloud dashboard) show progress under the right step without knowing domain fields; a step's last report can land in its entry; concurrent group members stop overwriting one field. Design it as part of the observation seam - one feed - not as Runner surface first, and without an instruction: attribution is the runtime's. Writes through a step's proxy are attributed already (the frame, `wrote`). Unmanaged writes (`this.is`, `_` helpers) bypass the frame - `this.is` cannot become an attributing proxy, since mvc's `get`/`set` key their stores by `this.is`; the seam needs another route (the active frame during a step's synchronous turn; `AsyncLocalStorage` on servers). Until then ordinary fields and a subscribed UI cover the app side ([docs](packages/steps/docs/README.md#coordination-first)).

## Held - nesting and interrupts

Not built. A child `Steps` as a plan item of its parent, with handlers the child can raise while it runs.

- **Child as a plan item.** Inside a parent step, a child `Steps`'s run is a token like a step's: `this.turn.run(text)` issues it - `turn` a field holding the child, `has`-owned or a plain owned Model. The parent's plan continues once the child's run settles; its result is the token's value to whatever reads it next (an arg of the following step, or the parent's `run` tail).
- **Interrupt handlers.** `this.then(childToken, this.permission)` - step references listed beside a child token are handlers callable repeatedly while the child runs, unlike a wait's single answer. Each call is a side branch concurrent with the child: its own frame, entry and subtree, journaled with `wake: <child token id>`. The child's completion closes the wait; handlers still in flight settle first.
- **Handlers may open waits** - `permission` parks on `this.then(this.allow, this.deny)` as any step does; the outside answer resolves the handler's branch, and the child, awaiting the handler, continues.
- **Raising an interrupt.** The child reaches its parent with `get(Parent)` and calls the open handler - an outside call by the existing rules: accepted while the parent's wait lists it, journaled in the parent, its call's Promise resolving when the handler's branch completes. No new channel.
- **Both ends recognize each other.** The child, held in a field of a runnable parent, is owned by it through mvc; at activation `run` finds its owner's run - public as `this.get(Model, false)`, known once the parent adopts the field, so after the constructor sets up `then` - and inherits its lifetime - the parent's run stopping, failing or ending stops the child's (internal; no public `signal` option). The parent's step proxy recognizes a runnable value (its `then` is a `Runner`) and hands back a view whose `run(x)` schedules a child-run token instead of starting it. `run` stays the one start verb - from outside it starts, from a parent step it plans; `then` stays await.
- **Ownership and teardown are mvc's.** The parent owns the child; destroying the parent stops the child (`set(null)` stops). `stop()` on the parent stops the child's active run; a child stopping on its own fails the parent's step unless handled.

Open questions:

- **Child token shape.** A `Steps.Node` with `child`, so a parent journal reads `{ id: 'turn#1', key: 'turn', child: 'Turn-…', args }`? Outside a step `run` stays the Promise.
- **Child failure.** Leaning: a failed child run fails the parent's step, unwinding the parent; the child unwinds itself first, and its tail sees it first.
- **Direct calls.** `agent.turn.run(x)` from outside still runs the child independently - leaning allow, it is the same object. The child's own waits stay the child's: outside callers answer through the child instance; the parent sees only its handlers.
- **Rewind independence.** The child unwinds by its own steps' compensations; does the parent's unwind reach into a child that completed - running the child's compensations - or treat a completed child as one opaque entry with its own?
- **Handler concurrency.** Handlers run concurrently with the child's own steps; writes to shared parent fields and collections are attributed per frame. Serialize handlers per child, or leave it to the user?

## Open

- Bullpen options, not until a case needs them - as `static readonly` members: `signal` - an outside `AbortSignal` tying the instance's lifetime to it (nesting inherits lifetime internally instead). `strict` - the runtime's warnings (a wait with closures held, an irreversible halt) throw.

- Routing matches the first argument only; two waits opened with the same first argument are answered oldest first.
- Status is `waiting` while any wait is open, even with other members in flight.
- `Steps`'s constructor sets up `then` before subclass fields exist, so its scan cannot see a subclass field shadowing a prototype method (the `Object.hasOwn` skip). A field holding a function in place of a method is not a pattern the examples use.
- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `end` dump, if any.
- The lateness guard sees token events only: a sync side effect after scheduling is invisible to it.
- A map restores through its own `set(key, value)`: a factory map passes the old value to its factory, so only keys the step added restore exactly. The factory/insert mode is not visible through public API.
- A pool member removed without being destroyed (a guest) still counts as irreversible; a class-mode pool could re-admit it by `add(instance)`.
- A popped value goes back at its old index, so a sibling's insert before it, meanwhile, shifts where it lands; inserted and `set` values are found by identity, so equal primitives pushed by two frames are told apart by position only.
- A pool member or map value destroyed directly (`set(null)`) is evicted by mvc, not through the wrapper - unmanaged, not irreversible.
- The caught step itself as handler (`this.scan(x).catch(this.scan)`) runs once more at most - the handler's token is not caught; repeated retry is the issuer form, bounded by `this.then.retry`.
- `back()` halting at a `committed`/irreversible entry still continues the plan - retry calls after it run against state the unwind did not reach. The back entry does not say it halted; the halting entry does.
- Steps the caller scheduled before `back()` have run when the token is reached and are unwound with the rest; the caller's own entry stays.
- Inline arrows of one step in flight together (a group) keep the settled-proxy rule - writes unmanaged, step calls outside calls; the proxy cannot tell them apart. A timer or lost watcher calling through a step's proxy while its one inline arrow runs lands in that arrow's frame.
- A lost watcher calling an accepted step answers another open wait if one accepts it - its own wait is closed, so the call routes as any outside call. Its signal is aborted; a watcher honoring it never gets there.
- Watcher typing covers one or two watchers after the steps; a watcher before a step reads `signal` as `any`.
- A watcher `function` (not an arrow) is called on the opening step's proxy, matching what an arrow sees; the design left its `this` open.

## Durable tier (parked)

A resumable sequence of runnables with checkpoints. It attaches to the shipped `Steps` class - options as `static readonly` members, hooks declared there. Nothing here is base-tier behavior.

- **Record.** `get()` extended with `pending` and values; `{ class, args, journal }` is enough to rebuild an instance mid-swing, so instances are fungible - resume, retry, fork to debug are one operation with a different cursor. Values must survive structured clone: `has`/`map` children snapshot recursively, `get()` references re-resolve by context, `ref` and computed fields are skipped, `set(async)` factories journaled like steps.
- **`save(record)` / `wake(at)`.** Seams on the class where they read as its business, config where a host supplies them, class winning. `save` is awaited before the next step - durability is "every commit awaited". `wake` defaults to `setTimeout`; a host persists `wakeAt` and resumes later.
- **`resume`.** `run.resume(Type, record)` rebuilds: values overlay, then the pending plan with its journaled args. Construction and resume are one operation - an overlay, then the entry.
- **Durable undo by returned token only.** Closures do not survive a resume; `{ key, args }` does. The base tier's `wait`/`sleep` warning is this constraint surfaced early.
- **Durable timers - revisit with the hot path.** `slot({ after })` is in-process too - its `setTimeout` dies with the process. A watcher's `await delay(DAY, { signal })` dies with the process, and a closure cannot be rebuilt on resume. Long waits need a durable form the host can persist and re-arm - a timer whose deadline is in the record (`wakeAt`), firing a named answer step - e.g. a wait option `{ after: DAY, call: this.refund }` or a `this.then.sleep(ms)` token backed by `wake(at)`. Closure watchers stay the in-process form.
- **Hydration hooks.** `before`/`after` may gain a trailing replay flag - true when a step is restored from the record - appended so the base-tier signature stays valid.
- **Slot form.** `run(Type, cfg)` - a host ships `const durable = (cfg) => run(self, { save, wake, ...cfg })`.
- **Persistence.** ORM-backed records; persistence adapters.
- **dev as a host.** The package stays generic. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so a parallel fork is a server capability; the walk's `key()` scoping a run to an identity. The record and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.
- **Destroy with rescue.** `set(null)` mid-run commits the in-flight entry flagged `cancelled` with its patch and runs `save` before stopping.
