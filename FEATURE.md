# @expressive/run

Runs built from `Model` classes. Scope and agreed shape - update as decisions land.

Two tiers. A **runnable** - a `Job`, or any Model with `run(this)` - is atomic: single process, all or nothing with undo closures, repeatable. The **job tier** - later, on the same `Job` class - is a resumable sequence of runnables with checkpoints. The runnable is the base tier and the current work; the job tier is parked at the end of this file.

## Workflow

- `feat/run` is the trunk. Each step lands as its own PR into it, small enough to hand-review; the trunk merges to `main` when release-ready.
- Merge `main` into the trunk as it moves. Run depends only on published mvc behavior.
- `packages/run/docs/` is the LLM-facing documentation of shipped behavior and the review surface for intent. A PR that pivots behavior updates the docs in the same PR. FEATURE.md stays the agenda. Root `skills/` will later be assembled per module from such folders.
- `packages/run/examples/<case>/` holds the benchmark classes with their tests - the DX as a user writes it, no runtime internals. Standing exception to the adjacent-test rule, recorded in AGENTS.md.
- Examples carry light learning comments - an exception to the no-comments rule - and together cover every shipped feature, mapped in [examples/README.md](packages/run/examples/README.md); a PR adding a feature extends an example.
- The package is `private` until its first release; nothing is exported from a published entry.
- Trunk commits carry no trailers.

## Goal

Long-running processes the Expressive way. A `Job` - a Model with `then = run(this)` built in - is runnable: `next()` starts a run, its methods are steps which schedule one another, its fields carry the data between them, `end` ends it. The `Runner` the instruction returns is the controller - status, queue, waits, result. Each step's entry - its args, what it wrote and what it scheduled - is handed to `after` as it commits, so a run is legible mid-swing; the undo a step returns makes it atomic.

Reference case study is Inngest. It replays an orchestrating function because closures cannot be serialized, so data leaves a step as a return value and re-enters as a memoized input. Here there is no orchestrator and no replay: steps never await each other's work, a run is a plan of tokens, and each step commits its own patch.

## Agreed shape

Shipped behavior is documented in [packages/run/docs/](packages/run/docs/README.md); this list holds the decisions behind it and those not yet built.

- **`Job` is the base, `run(this)` the instruction, `Runner` the controller.** `class X extends Job` is canon; `then = run(this)` on a Model is the escape hatch for a class that cannot extend `Job`: `readonly then = run(this)` built in (TS `readonly`), the contract declared as optional members with JSDoc - public `next?(...args: any[])`, protected `end?(value?)`, `before?(step, args, skip)`, `after?(step, entry, skip)`, `back?(reason)` - so subclasses get autocomplete, `override` catches misspellings and signatures are checked by declaration; nothing is emitted on `Job.prototype`. `next(prompt: string)` narrows freely (method bivariance). `await job` is typed by `end` through `Runner.Result`, else the values dump; `then` is `Runner<this>`. Per-step `before<Step>`/`after<Step>` stay runtime-checked. `run(this)` stays public - the casual form for a Model that just wants runnable steps, opting in with one field, as with `ref(this)`; hooks are found by name either way, and may also be passed as options.
- **`run(self, options?)` takes one options object - `Runner.Options<T>`.** `base`: the topmost class whose methods are steps and name-found hooks; the walk runs from the most-derived class up to and including it, never past - classes above stay plain methods, callable inline from a step and from outside. Default: the most-derived class only - a parent's methods stay plain, and a subclass of a `run(this)` class without `base` gets only its own methods as steps, so a runner meant to be extended passes `base`. An instance not `instanceof base` throws `<instance> does not extend <base>.` `Job` passes `base: Job`. Hooks `before`/`after`/`back`/`exit` as options, typed against the instance (property function types with a `this: T` parameter, so a wrong signature fails to compile and `exit`'s outcome is `Runner.Outcome<Runner.Result<T>>`), called with the raw instance as `this`, after the class's same-named hook when both exist; same semantics otherwise - `back`/`exit` each run even when the other throws; a throw from `back` replaces `error`, one from `exit` is reported uncaught.
- **A `Job` subclass configures its run through `static readonly` members** - none at this tier (`rewind` left: restoring is per step, by return); the job tier adds `save`, `wake`, `strict`, declared with `declare static` so nothing is emitted on `Job`.
- **The instruction.** The initializer runs after the class has bootstrapped and before activation, so the instruction sees every step before any is bound. It defines wrapped steps as own, non-enumerable properties of the instance; the prototype is never touched. Getters, `new`, `_` helpers and hooks are not wrapped - hooks stay plain methods, callable from outside. The `Runner` is an observable callable, not a Model - a function made observable with `event`/`touch` from `@expressive/mvc/observable`, as `map`/`has` are. Hook names aside (`before…`, `after…`, `back`), no name on the user's class is reserved - with `run(this)` the field name is the user's.
- **`next(...args)` is the entry.** User-declared, any parameters. From outside it is the only callable step: it starts a run and returns a Promise settling with it. Any other step reads `undefined` from outside unless an open wait accepts it; a held reference called otherwise throws (`<key> cannot be called from outside; call next() to run.`). Inside a step `this.next(x)` is an ordinary step call - how an agent loops. `new()` stays mvc's setup hook, unwrapped; no auto-start - a class wanting one writes `new() { this.next(); }`.
- **Runs repeat.** Each run has its own ids; fields persist; `runs` counts finished runs; a finished run returns status to `idle`, `stopped`/`failed` hold until the next run starts. `next()` while a run is active queues a run, FIFO, listed in `then.queue`; each call's Promise settles with its own run; a failure does not clear the queue.
- **`await instance` is start-or-join.** Idle with nothing queued, it calls `next()` with no arguments - or rejects (`<instance> is idle. next() takes arguments; call it to start a run.`) when `next.length > 0` - a TS-optional parameter counts, so it needs a default (`next(prompt = '')`) to start on an idle await; otherwise it joins - settling once the active run and the queue drain, with the last run's result. The thenable is always in the type: `Runner<T>` is `Runner.Controller<T> & Runner.Thenable<T>` for any `next`. `then` - built into `Job`, or `then = run(this)` - is the primary form - `Promise.resolve(instance)` and a `set(async () => X.new())` factory resolve to the result. A tracking read of `then` is an observable view and not callable. `run = run(this)` keeps it `await x.run`.
- **Inputs are fields, or `next`'s arguments.** `X.new({ cart })` assigns fields as any Model's constructor does, so they show in the dump, the journal, a twin and inspect. Required inputs are not enforced by the type (`Assign<T>` is partial); a missing one fails at the step that reads it.
- **A step body is a plan builder.** A step called from inside a running step does not run: it returns an inert, non-thenable token, scheduled after the calling step settles cleanly. Tokens run in sequence, depth-first: each, with everything it schedules, before the next sibling. `this.then(a, b)` / `this.then(items, each)` makes one parallel group at that point - variadic; `[]` is only the items of `then(items, each)` - members run concurrently, the group completes when every member's subtree has. Commit is `{ id, key, args, next, wrote }` on clean settle - no values; a step that throws has scheduled nothing.
- **`then` is overloaded by argument.** Inside a step: tokens are a group; `(items, mapper | step)` a mapped group; steps of this instance, plus plain functions as watchers, a wait; one plain function an inline step; tokens mixed with functions throw (`then() takes called steps or step references, not both.`); anything else - two functions, the thenable, `await this` included - fails: `a step cannot await its own run.` Outside a step, `then(f, r)` is the thenable and an object throws. In-step signatures return `Promise<void>`, as a step call does - so `.catch` is typed and a returned token keeps the step `Promise<void>` - and carry a generic `this` parameter so the await check skips them; the instance stays awaitable when the thenable part is present. A wait's watcher is typed `(signal: AbortSignal)` when it trails the steps (one or two).
- **The first step call ends the step's work.** After its first token, a step may only issue tokens, group them, and return. Enforced two ways: a write through the step's proxy after its first token fails the run; a settle landing later than a few microtasks (`SLACK`) after its last token event - issue or group - fails the run. A sync side effect after scheduling cannot be detected; side effects are steps. Documented discipline.
- **Each step runs with a proxy as `this`.** Writes through it are listed in the entry's `wrote`, their prior values held while the step is in flight so a throw or abort restores them; a token is attributed to the frame whose proxy issued it, so parallel members attribute without `AsyncLocalStorage`. Reads pass through; Model's own methods bind to the instance. `this.is` is the real instance: a write through it, or from outside, is a steer - allowed, in no patch.
- **`_`-prefixed methods are helpers**, mvc's unmanaged convention: not wrapped, called inline, run on the instance as mvc binds them - their writes are in no patch, pass the write guard and are not rolled back. A helper computes; the step assigns.
- **Steps are `protected async`** - opinionated convention, opt-out, applied in examples and docs. `next` and answering steps stay public; `end` and hooks are protected - `Runner.Result` reads `end` by indexed access, which sees protected members, and unwraps it with `Awaited`.
- **Return guard.** A step returns nothing, `true`/`false`, a function (its undo closure), or a token it issued - `return this.release(id)` removes the token from the plan and journals it as a durable undo `{ id, key, args }`. Anything else fails the run. `end`'s return is its result, not an undo.
- **Undo takes any token kind.** A returned step token runs its step; an inline step its function; a group its members, concurrently; a wait parks the unwind until answered - `return this.then(this.refund, this.keep)`, its watchers starting when the unwind reaches it. While parked: status `waiting`, `then.waiting` shows it, the run does not reject; `stop()` halts the unwind there (`halted: true`, status and `error` stay the failure's, the run rejects with it); `stop(undo, reason)` records `reason` on the halted entry and as `stopped` in `exit`'s outcome - the error untouched. The answer runs as an undo frame - journaled with `wake`, no hooks, cannot schedule; its throw, or a watcher's before an answer, fails the undo. Any answer completes the entry's compensation and the unwind continues, restoring the step's fields - a returned wait is an undo - except one calling `this.then.commit()`: the unwind halts at the entry (`halted: true`), its writes kept - the decline.
- **Inline step.** One plain function, `this.then(() => ...)`, is an anonymous step journaled `then#n` (key `then`, `args: []`), run in its place as a full step frame - hooks with key `then` - given its frame's `AbortSignal` (what `this.then.signal` reads in a method step). Typed `Promise<void>` like a step call, so `return this.then(() => stripe.refund(id))` keeps a step `Promise<void>`. Not durable. A `function` gets its own proxy; an arrow's `this`, the enclosing step's settled proxy, hands writes, step calls and `this.then` to the inline frame - while it is that step's only inline frame in flight (nested ones walk up) and no wait that step opened is open. Otherwise the settled-proxy rule below holds.
- **`end` is terminal.** Class hook `end(value?)` and `this.then.end(value?)` mean the same: a token sequenced like any other, run at its place depth-first; running it ends the run exactly as an outside `then.end()` does (one implementation) - pending discarded (not journaled), waits released, slots released or cancelled, in-flight steps aborted, settling and committing with what they schedule dropped. Its return, else its argument, else a dump of public values (the `Runner` excluded) is the result. Early exit is calling `end` - planned (`next` lists every step, one ends early) and chained (each step calls the next) styles need no flag. Any call after `end` in the same step - a second `end` included - fails the run (`end must be the last call in a step.`); a token returned as the undo is not a call. Two parallel `end`s: the first reached wins, the other is dropped. Stop, failure and unwinds in progress keep precedence. A plan that drains without `end` ends with the dump, journaling `{ id: 'end#n', key: 'end', args: [], next: [], wrote: [], implicit: true }` - no hooks. `end` scheduling a step fails the run.
- **Every step is atomic; rewinding a settled step is per step, by what it returns.** An entry records `wrote: string[]` - no values. A frame holds prior values (fields, and inverses of its collection changes) while in flight, so a step that throws or is aborted restores its own partial writes. On commit it keeps them only if it returned an undo (closure, step token, group, inline step, wait) or `true`; nothing or `false` drops them. On failure: status `failed`, pending discarded, waits released, in-flight signals aborted, the failing step's own writes restored; in-flight members settle and commit; then every committed entry is unwound in reverse - its undo if any (closure with a proxy as `this`, or the undo token), then its kept priors restored, `undone: true`; an entry with neither is passed over and its fields stay. All or nothing is each writing step returning its undo or `true`. Kept priors live until the run ends. Irreversible detection runs whatever a step returns - it governs catch and where the unwind halts. Learned from agent-focus: a transcript is the product of a run, and one long step holds most of it, so retaining every value for an unwind that should not erase it is the wrong default - and a class-wide `rewind` flag was too coarse; the step knows. An undo that throws marks `undone: 'failed'`, replaces `error`, stops the unwind. Undo frames cannot schedule. Then the result rejects; unawaited, it rethrows uncaught two microtasks later.
- **`this.then.commit()` is a deliberate point of no return.** Inside a step it marks the entry `committed: true` - a separate flag, so no field name is reserved in `irreversible`. From then the step's failure is not caught, a throw after it keeps its writes (journaled with `error`), and the unwind halts at it - `halted: true`, its undo and everything before it not run - as at detected irreversibility, without the warning. Outside a step, or through a settled proxy, it throws.
- **`this.then.back(step, reason?)` unwinds on command.** A token in the plan, like a step call. `step` is a required step reference - a call, string or nothing throws (`back() takes a step to go back to; stop(true) unwinds the whole run.`); undoing everything stays a failure or `stop(true)`. Exclusive: when the plan reaches it, every entry committed after `step`'s latest (the caller excluded - not committed yet; its writes stay) is unwound newest first by the failure path's own unwind - undos, kept priors, halting at `committed`/irreversible entries - and pending items those entries scheduled, transitively, are discarded (not journaled), their waits released, in-flight ones aborted, settled and unwound too. Then `{ id: 'back#n', key: 'back', args: [], next: [], wrote: [], to: '<entry kept>', reason? }` is journaled, `back(reason)` runs, and the plan continues with what the caller scheduled after `back()` - a retry is an ordinary call (`this.pay(card2)`) or a wait (`this.then(this.pay)`); the run does not fail. A halted unwind still continues. No `step` entry fails the run (`back() found no committed <step>.`); an undo or `back` hook throwing fails it. Parallel backs serialize; an `end` from an unwound entry is dropped, one after `back()` runs at its place. Not groupable, not an undo. Entries a back undid are skipped by any later unwind - the failure path is the same unwind over what is left.
- **`this.then.signal` is the step's `AbortSignal`.** Method steps have their own proxy as `this`, so it names the right frame. Aborted on `stop()`, an outside `end`, a failure elsewhere, and when the frame settles; the wait race is the watchers' (`signal` parameter). A step rejecting with its signal's `reason` after the runtime aborted it is no new failure: writes restored, nothing it scheduled runs, not caught, no entry. A different error thrown after the abort fails the run. Outside a step, reading it throws. Inline steps and watchers keep the parameter.
- **`exit(outcome)` runs once per run on every terminal outcome** - `{ status: 'done', result } | { status: 'failed', error, stopped? } | { status: 'stopped', error }` (`Runner.Outcome<R>`), `error` being what the run rejects with, `stopped` a `stop()` reason given while the failure unwound - after `end` / the unwind / `back`, before the run's Promise settles. A hook, found by name on `run(this)` classes too; declared on `Job` taking `Runner.Outcome` (unknown result) since a `this`-polymorphic `Result<this>` rejects every override - a subclass narrows `R`. A throw from it - class or option - does not change the outcome: status, result and rejection stand, and the error is rethrown uncaught on a microtask, as an unawaited failure is. Not `finally` - the instance is thenable.
- **`then.end(value?)` from outside ends early** - the `end` token's own path, run now. Pending discarded (not journaled), waits released, in-flight signals aborted, in-flight steps settle and commit, then `end` runs with `value` and the run resolves as a normal end - nothing undone; the queue proceeds. Idle, or already ending/halted, it does nothing. An in-flight failure meanwhile still fails the run.
- **`stop(undo?, reason?)` cancels.** Pending discarded, waits released, in-flight signals aborted, in-flight steps settle and commit but schedule nothing, status `stopped`, queue cleared with each queued Promise rejecting with an error named `'Stopped'`, the current run rejecting with it once in-flight steps settle. `stop(true)` unwinds as a failure does. `reason` is the `'Stopped'` error's `cause`, and its message when a string; the run, the queue, `back` and `exit` see that one error; `then.error` stays unset. `set(null)` stops. Finishing never destroys the instance.
- **`this.then(...steps)` waits.** Step references, no array - a token parking that point in the plan, answered by any one of the listed steps; what follows runs after the answer's subtree. Plain functions among them are watchers (below). Journaled `{ id: 'wait#n', key: 'wait', args: [], answers }`; status `waiting`; `then.waiting` lists `{ id, step, args, answers }` - the opening step's key and args. `next`/`end` cannot answer. A wait reached while closure undos are held warns once per run - a job-tier constraint surfaced early.
- **Answering steps are present only while waited for.** Every step but `next` is an own non-enumerable getter: from outside it reads the step while an open wait in the current run accepts it, else `undefined`; the read `touch`es its key and a change in the accepted set emits `event(instance, key)`. Inside a step every step reads through the proxy as usual. The declared type stays non-optional. An outside call answers the open wait whose opening step's first argument is `===` its own, else the oldest accepting it - journaled `wake: <id>`, run in the wait's place. It returns a Promise resolving when that step and its subtree complete (also when an outside `end` drops the subtree), rejecting with the run's error if it fails or stops first; awaiting it counts as awaiting the run. No buffering.
- **Watchers.** A plain (non-step) function in a wait's arguments starts when the plan reaches the wait, called on the opening step's proxy with an `AbortSignal` - a parameter, not `this.then.signal`, since an arrow's `this` is the enclosing step's proxy. The wait closes on its first answer - from outside or a watcher; then every watcher's signal aborts; `end`/`stop`/a failure close every open wait too. A watcher that settles without answering leaves the wait open - a nudge, not a decision. One that throws before the wait closes fails the run; a lost watcher's errors are discarded. Watchers are functions only, never tokens - their writes are unmanaged, like `_` helpers; in-process, not journaled.
- **A settled step's proxy calls from outside.** A call through a settled step's proxy - a watcher's arrow, a timer - is an outside call: nothing buffered, throws `<step> has settled; <key> cannot run.` when no open wait accepts it. It answers that step's own open wait first, else routes as any outside call; it is bound to its run - after that run ends every call through it throws, so a sleeping watcher cannot answer the next run's wait. Writes through it are unmanaged.
- **Collections a step changes are part of its unit, per frame.** A `has` list, `has` pool or `map` read through the step's proxy (detected by `instanceof has.List`/`has.Pool`/`map.Managed`, public classes) comes back as a per-frame wrapper - a Proxy whose mutators record an inverse for that frame, then forward; reads forward to the collection. The entry's `wrote` lists the field once the frame changed it. Restore - rollback, or an unwind of a step that kept its priors - replays the frame's own inverses, newest first, so parallel siblings' changes stay: inserted values removed by identity at the nearest equal item, removed ones put back at their index, `set` reversed where its value now is, pool members the frame added deleted, map keys added deleted and changed ones set back; a value a sibling already removed or replaced is skipped. A change through the wrapper after the frame's first token fails the run, as a field write does. Changes not through a frame's wrapper - outside, `this.is`, helpers, a wrapper kept past its frame's settle - are unmanaged. A pool member removed, or a map value destroyed on removal or replacement, that the frame did not add itself cannot come back: without a user undo the entry is `irreversible: [field]`. An irreversible step's failure is not caught - its failing try is journaled with `irreversible` and keeps its writes; the unwind stops at the first irreversible entry, newest first, marking it `halted: true` with one `console.warn`; `error` stays the original. A user undo makes the step reversible: the undo runs, then what can be restored is. Plain arrays and objects mutated in place are not observable - assign instead.
- **`this.then.slot({ max?, after?, key? })` is a token.** Reached, it waits `after` ms (`setTimeout`), then queues FIFO for a slot under `max`; the frame's later items - and their subtrees - run holding it, then it frees for the next waiter. Scope: no `key` - the nearest mapped or variadic group above the frame (by the plan's parent chain), else the job instance; an object key - one queue in a module `WeakMap`, across groups and jobs; any other key - a per-`Runner` `Map`, so a primitive scopes to the job instance. `max` is a number or a function - live from a UI; default unlimited, so `slot({ after })` alone is a delay; `0` pauses. `($) => $.limit` takes the job's mvc tracking proxy and runs in the instance's `get(effect)` while the slot waits, so a change to anything read through `$` - nested Models included - re-pumps the queue; the effect is cancelled once the waiter is granted or cancelled. A zero-arg function is re-read on every release and on any update of the job instance (an mvc `listener` while it waits) - a closure over another Model refreshes only then. A slot reached under a hold its own lineage has in the same queue, the holder still in progress, re-enters it without a second slot. `stop()`, an outside `end` and a failure release held slots and cancel waiting ones; a `back` cancels the waiting ones it discards. Journaled `{ id: 'slot#n', key: 'slot', args: [] }` in `next`. Not groupable, not an undo; outside a step it throws.
- **A pending read waits.** A step throwing a `Promise` - mvc's suspense, from an unset `set<T>()` or a getter over one - restores its writes, drops its tokens and runs again from the top once it resolves: no entry, no hooks refired, no `retry` counted. A rejection is the try's error. `stop()`/an outside `end` meanwhile aborts it as its signal would. Past `commit()` or an irreversible change it fails as any throw.
- **`.catch(handler?)` on a token; `this.then.retry`, `this.then.caught`.** Tokens share a prototype with `catch` and no `then`; `.catch` returns the same token, journaled with `rescue` (handler key, `then` for a function, `true` for none). The branch is the token's subtree by the plan's parent chain. A body throw in it - not a rule violation, not past `commit()` or irreversible, not an abort, not while stopping or ending - is caught by the nearest active caught token: the failing frame restored and journaled `{ id, key, args, next: [], wrote: [], error }`, the branch discarded (pending dropped, waits released, slots cancelled, in-flight aborted), its committed entries unwound by the failure path's unwind - serialized with backs - then the handler runs in the branch's place and the plan continues. `.catch()` skips; a step reference runs that step with the failed token's args; a plain function runs as an inline step given the error. In the handler `this.then.caught` is the error. `retry` counts re-runs - 0 on a step's first run, so `!this.then.retry` means it has not failed: one past the issuer's when the handler is the issuing step (`.catch(this.visit)` in `visit`), 1 when it is the caught step itself, else 0; an entry past 0 carries `retry`. A handler's parent is the caught token's, so slot scope and reentry follow the branch it replaces - except a handler re-running the issuer: the issuer's held slots are released before it starts, so the re-run waits its `after` and queues at the back. Back, slot and end tokens throw; a token returned as an undo ignores its catch. Replaces the `retry({ attempts, backoff })` config - retry is `.catch(this.step)` behind `this.then.retry`, backoff `slot({ after })`.
- **Hooks.** `before(key, args, skip)` / `after(key, entry, skip)` and per-step `before<Step>(skip, ...args)` / `after<Step>(skip, entry)`, excluded from wrapping by prefix (followed by an uppercase letter, or the bare name); `back(reason)` and `exit(outcome)` by name. Order: before → before<Step> → step → after<Step> → after; once per step - a catch handler is its own step - not for undos. Raw instance as `this`, writes unjournaled, return ignored. `skip` is always false at this tier; the signature is shared with the job tier. A per-step hook without its step throws at construction. `back(reason)` runs once after each unwind completes - halted or not: after `then.back(step, reason)` with that reason, the run continuing (a throw fails it); for a failure or `stop(true)`, not `stop()`, before the run rejects, `reason` being what it rejects with - a throw replaces it (as an undo's throw does). Once per unwind: a throw after `then.back()` fails the run without the failure's unwind calling it again.
- **Runner surface.** `status` (`idle | running | waiting | stopped | failed`), `active` (a step in flight, the latest invoked with a group), `queue`, `waiting`, `runs`, `error` - enumerable getters, so `{ ...instance.then }` is a snapshot; `on`; `end`, `stop`, `commit`, `back`, `slot`, `signal`, `retry`, `caught`; a non-enumerable `get()` snapshot.
- **The Runner keeps no journal.** Entries exist transiently: each committed step's is handed to `after(step, entry)` - a class wanting a log keeps them, and a later unwind updates a kept entry in place (`undone`, `halted`, `reason`). Entries the runtime makes for its own unwind - a caught or committed failed try, a `back`, an implicit `end`, an unwind's answer - reach no hook. Internally a run keeps its light entries (no values) for `back` and the unwind to walk, the undo registry, and priors of steps that opted in - all dropped when the run ends. Record retention is not run's job: exhaustive logging and dashboards move to `@expressive/inspect` through an observation seam - designed next, generically for companion UIs, e.g. a `/__steps` page component droppable into a router.
- **Data lives in fields and args.** Fields persist across runs; args are step-scoped and journaled. Any value reaching `end` flows through one or the other.
- **Core changes go upstream.** Public mvc API only - `@expressive/mvc` is a workspace peer.

## Benchmarks

Two classes drive design and tests, both green: [SubmitOrder](packages/run/examples/order/order.ts) and [Agent](packages/run/examples/agent/agent.ts), each with mocked services. [Deploy](packages/run/examples/deploy/deploy.ts), [Sync](packages/run/examples/sync/sync.ts) and [Crawl](packages/run/examples/crawl/crawl.ts) cover the rest ([examples/README.md](packages/run/examples/README.md)).

```ts
class SubmitOrder extends Job {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';
  notice = '';

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

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
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

  protected back(reason: unknown) {
    this.notice = `Order ${this.cart.id} was not placed: ${reason instanceof Error ? reason.message : reason}`;
  }
}

const result = await SubmitOrder.new({ cart });
```

```ts
class Agent extends Job {
  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();
  draft = has<string>();

  async next(prompt: string) {
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

await agent.next('ship it');            // one turn
await agent.next('now the tests');      // the next - messages persist, then.runs == 2
```

Order returns an undo from every step that writes - a failure puts every field back. Agent's steps return nothing, and it exercises what Order does not: a run per turn on one instance, a queue, park and wake by outside call (`allow`/`deny`) or a timeout watcher, steering (`agent.mode = 'yolo'` before the next `tool`), a failing turn keeping what earlier steps pushed to `messages` while its own `draft` chunks are dropped, `stop()` mid-turn aborting the model call through `this.then.signal`.

A UI dogfood lives in the examples playground: [run/checkout](examples/pages/run/checkout/App.tsx) - cart → reserve → pay → approval wait with a timeout watcher → ship ∥ receipt → end, a decline going `back` to `reserve` and waiting on `pay` for another card, `stop(true)` - rendered on React and dom, with a Playwright spec.

## Crawler (benchmark)

A shopping UX scanning several sites at once, deduping products into one live list, driven by a user or an agent through an abstracted browser.

Principle: imperative seams that read tracked values when they run, over declarative config fixed before a run starts - a limit or a backoff may change live from a UI. Build blocks, not opinions. Agreed shape:

- **Per-frame collection attribution** - the correctness fix, first. A step reading a `has`/`map` through its proxy gets a per-frame wrapper: its mutators record an inverse for that frame, then forward to the collection; reads forward untouched. Rollback of a frame replays only its own inverses, newest first - parallel siblings untouched. A mutation through the wrapper after the frame's first token fails the run, as a field write does. Mutations not through a frame's wrapper (outside, `this.is`, helpers) are unmanaged. Irreversibility (a pool member removed, an owned map value destroyed) is detected per frame. Replaces the shared snapshot capture.
- **`this.then.slot({ max, after, key })`** - a plan token completing once a FIFO slot is free under `max` and `after` ms have passed since it was reached; what the frame schedules after it runs behind it and holds the slot until done. Scope: the enclosing group, else the job instance; `key` shares one queue across groups and jobs - a mutex at `max: 1`, a semaphore for a browser-context pool. `max` may be a function, re-read live. Covers the group concurrency limit, the cross-job lock and the shared context pool; `slot({ after })` alone is a delay.
- **`.catch(handler?)` on tokens, `this.then.retry`** - branch-local recovery: a caught branch failing has its committed descendants unwound and the run continues - `.catch()` skips it (allSettled groups: `this.then(sites, (site) => this.visit(site).catch())`), `.catch(this.step)` runs a step in its place with the failed token's args, `.catch(fn)` an inline step given the error. `this.then.retry` counts a step re-run from its own catch. Replaces the `retry({ attempts, backoff })` config: retry is `.catch(this.step)` behind `this.then.retry`, backoff is `slot({ after })`.
- **Driving the run mid-flight, concurrency of parallel branches** - user construction, no new API: a mailbox `has()` pulled by a loop, handler steps answering waits, a `skipped` set checked at a step's top to drop a branch. Signals stay an engine detail.
- **Journal growth** - decided: the runner keeps only what unwinding needs; each committed entry is handed to `after(step, entry)` so a user builds their own flat log; `record` left the Runner, and `rewind` with it - a step keeps its priors by returning an undo or `true`.

## Plan

In order; stop and reassess after 2 if the journal is ugly.

- [x] **The loop** - `run(this)` wrapping steps per instance (own, non-enumerable), proxy-bound frames, plan-builder tokens, settle-then-commit, write and lateness guards, return guard, `_` helpers, undo closures and returned-token undos, reverse unwind with `prior` restore, terminal end and implicit end, `Runner` as observable callable, `then = run(this)` making the instance awaitable. Order green with mocked services, including the unwind.
- [x] **Repeatable runs, hooks, wait, cancel** - Agent green.
  - [x] **`next()` is the entry**, runs repeat and queue; `await instance` is start-or-join; an idle await rejects when `next` takes arguments.
  - [x] **Depth-first sequence and parallel groups** - `this.then(tokens)`, `this.then(items, each)`; tokens non-thenable; `after`/await-order dropped.
  - [x] **`this.then.retry({ attempts, backoff })`** - per step, hooks not refired. Superseded by `.catch`; the name now counts re-runs (`this.then.retry`).
  - [x] **Hooks** - `before`/`after`, per-step `before<Step>`/`after<Step>`; orphans throw at runtime (type check: see Open).
  - [x] **`this.then.wait(context)`** - park, `then.waiting`, wake by outside call; closure-undo warning.
  - [x] **`stop(undo, reason)`**, `set(null)` stops.
  - [x] **Fixes** - rollback all or nothing; `_` helpers stay unmanaged, on the instance.
  - [x] **Renames** - `end` (was `done`), `active` (was `step`), `record` (was `entries`), status `idle` (was `done`).
- [x] **Waits name their answers** - `this.then(...steps)` replaces `then.wait`; answering steps present only while waited for, reactive; routing by first argument, else oldest; per-call Promise; `then.end()` from outside ends early.
- [x] **`Job`** - Model base with `readonly then = run(this)` and the declared contract; `back` hook (also honored by `run(this)` classes). Examples extend it.
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
- [ ] **Steering entries** - outside writes journaled as their own entries, distinct from a step's patch, so a steer is visible in the trace.
- [ ] **`this.then.sleep(ms)`** - in-process, warning like a wait when closure undos are held. `slot({ after })` is the in-process delay meanwhile, without the warning; the durable form waits for the job tier.

Later, on `Job` - the job tier: `save`/`load`/`wake`, `skip = true` on replay, child Jobs as plan items with checkpoints; options as `static readonly` members.

Held: a class-level `catch` hook - recovery is per token (`.catch`).

Deferred: `property = run(X, ...args)` (a child run nested under one step of the parent) - superseded by the held design below, child `Job`s as plan items.

Learned from agent-focus (porting an ACP client: one long step awaiting `session/prompt` while transcript chunks stream into state) - not built:

- **Preempting `next`** - stop the current run, keep the queue, start the new one; today `next()` only queues and `stop()` clears the queue.
- **Run status in `instance.get()`** - the export holds the Runner function itself (see Open); a host serializing state wants `status`/`active`/`waiting`.
- **Steering mailbox** - a `has()` list pulled by the loop; shipped as a docs recipe ([runs.md](packages/run/docs/runs.md#steering---a-mailbox)), no API.
- **Step timeout** - via `this.then.signal`: an option aborting a step after `ms`, or `AbortSignal.any([this.then.signal, AbortSignal.timeout(ms)])` as a recipe.
- **Outside `fail(error)`** - fail the active run from outside (a transport error), unwinding as a step failure would; today only `stop(true)`.
- **Cross-job lock** - two jobs sharing one resource (a session) serialize - planned as `slot({ key, max: 1 })` ([Crawler](#crawler-benchmark)).
- **Interrupted-on-restart marker** - the job tier marks a run found in flight at load as interrupted rather than replaying a step with side effects.
- **Child jobs** - held design below.

## Held - nesting and interrupts

Not built. A child `Job` as a plan item of its parent, with handlers the child can raise while it runs.

- **Child as a plan item.** Inside a parent step, a child `Job`'s run is a token like a step's: `this.turn.next(text)` issues it - `turn` a field holding the child, `has`-owned or a plain owned Model. The parent's plan continues once the child's run settles; its result is the token's value to whatever reads it next (an arg of the following step, or the parent's `end`).
- **Interrupt handlers.** `this.then(childToken, this.permission)` - step references listed beside a child token are handlers callable repeatedly while the child runs, unlike a wait's single answer. Each call is a side branch concurrent with the child: its own frame, entry and subtree, journaled with `wake: <child token id>`. The child's completion closes the wait; handlers still in flight settle first.
- **Handlers may open waits** - `permission` parks on `this.then(this.allow, this.deny)` as any step does; the outside answer resolves the handler's branch, and the child, awaiting the handler, continues.
- **Raising an interrupt.** The child reaches its parent with `get(Parent)` and calls the open handler - an outside call by the existing rules: accepted while the parent's wait lists it, journaled in the parent, its call's Promise resolving when the handler's branch completes. No new channel.
- **Both ends recognize each other.** The child, held in a field of a runnable parent, is owned by it through mvc; at activation `run` finds its owner's run and inherits its lifetime - the parent's run stopping, failing or ending stops the child's (internal; no public `signal` option). The parent's step proxy recognizes a runnable value (its `then` is a `Runner`) and hands back a view whose `next(x)` schedules a child-run token instead of starting it. `next` stays the one start verb - from outside it starts, from a parent step it plans; `then` stays await.
- **Ownership and teardown are mvc's.** The parent owns the child; destroying the parent stops the child (`set(null)` stops). `stop()` on the parent stops the child's active run; a child stopping on its own fails the parent's step unless handled.

Open questions:

- **Child token shape.** A `Runner.Node` with `child`, so a parent journal reads `{ id: 'turn#1', key: 'turn', child: 'Turn-…', args }`? Outside a step `next` stays the Promise.
- **Child failure.** Leaning: a failed child run fails the parent's step, unwinding the parent; the child unwinds itself first, and its `exit` sees it first.
- **Direct calls.** `agent.turn.next(x)` from outside still runs the child independently - leaning allow, it is the same object. The child's own waits stay the child's: outside callers answer through the child instance; the parent sees only its handlers.
- **Rewind independence.** The child unwinds by its own steps' returns; does the parent's unwind reach into a child that completed - running the child's undos - or treat a completed child as one opaque entry with its own undo?
- **Handler concurrency.** Handlers run concurrently with the child's own steps; writes to shared parent fields and collections are attributed per frame. Serialize handlers per child, or leave it to the user?

## Open

- Bullpen `run` options, not until a case needs them: `signal` - an outside `AbortSignal` tying the job's lifetime to it (nesting inherits lifetime internally instead). `strict` - the runtime's warnings (a wait with closures held, an irreversible halt) throw.

- Hook alignment by type is enforced on `Job` by declaration for `next`/`end`/`before`/`after`/`back`; per-step hooks and `run(this)` classes are unchecked. `run(this)` in a field initializer infers the polymorphic `this`, and TS cannot relate `this` to a mapped type over it: `self: T & Aligned<T>` (a template-literal mapped type over `before${S}`/`after${S}` keys) rejects every class, aligned or not, and a conditional rest-parameter check stays deferred. A concrete check works only where the class type is concrete - e.g. an opt-in `class Agent extends Model implements Runner.Hooks<Agent>` (new surface, not added). Shipped instead: a per-step hook without its step throws at construction.
- `instance.get()` exports the Runner function itself under its field: mvc's `values()` duck-types `get()` only on objects, so the Runner's `get()` snapshot is not used there.
- Routing matches the first argument only; two waits opened with the same first argument are answered oldest first.
- Status is `waiting` while any wait is open, even with other members in flight.
- `Job`'s `then` initializer runs before subclass fields exist, so its scan cannot see a subclass field shadowing a prototype method (the `Object.hasOwn` skip). A field holding a function in place of a method is not a pattern the examples use.
- Hot reload: a patch's rebind redefines an own method and drops the wrapper. Re-wrapping needs a per-instance seam - a class-level `method` handler is a permanent side effect on the class, which the instruction avoids on purpose.
- Which `_`-prefixed convention excludes a field from the `end` dump, if any.
- `this.then.end`'s argument is `unknown` inside the class body (a conditional over the polymorphic `this` cannot resolve there); the typed path is the class's own `end`. Likewise `next()`'s Promise is typed by the class's `next` declaration, not the run's result - await the instance for the typed result.
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

## Job tier (parked)

A resumable sequence of runnables with checkpoints. It attaches to the shipped `Job` class - options as `static readonly` members, hooks declared there. Nothing here is base-tier behavior.

- **Record.** `get()` extended with `pending` and values; `{ class, args, journal }` is enough to rebuild an instance mid-swing, so instances are fungible - resume, retry, fork to debug are one operation with a different cursor. Values must survive structured clone: `has`/`map` children snapshot recursively, `get()` references re-resolve by context, `ref` and computed fields are skipped, `set(async)` factories journaled like steps.
- **`save(record)` / `wake(at)`.** Seams on the class where they read as its business, config where a host supplies them, class winning. `save` is awaited before the next step - durability is "every commit awaited". `wake` defaults to `setTimeout`; a host persists `wakeAt` and resumes later.
- **`resume`.** `run.resume(Type, record)` rebuilds: values overlay, then the pending plan with its journaled args. Construction and resume are one operation - an overlay, then the entry.
- **Durable undo by returned token only.** Closures do not survive a resume; `{ key, args }` does. The base tier's `wait`/`sleep` warning is this constraint surfaced early.
- **Durable timers - revisit with the hot path.** `slot({ after })` is in-process too - its `setTimeout` dies with the process. A watcher's `await delay(DAY, { signal })` dies with the process, and a closure cannot be rebuilt on resume. Long waits need a durable form the host can persist and re-arm - a timer whose deadline is in the record (`wakeAt`), firing a named answer step - e.g. a wait option `{ after: DAY, call: this.refund }` or a `this.then.sleep(ms)` token backed by `wake(at)`. Closure watchers stay the in-process form.
- **Hydration hooks with `skip`.** `before`/`after` share the base-tier signature; `skip` is true when a step is being replayed from the record.
- **Slot form.** `run(Type, cfg)` - a host ships `const durable = (cfg) => run(self, { save, wake, ...cfg })`.
- **Persistence.** ORM-backed records; persistence adapters.
- **dev as a host.** The package stays generic. A host adds: storing records and waking parked runs; a wake as a sidecar call; the run as a seat, its fields carried by twin values and the stream; `AsyncLocalStorage` attributing writes per branch, so a parallel fork is a server capability; the walk's `key()` scoping a run to an identity. The record and `resume(record)` are the host seam, so a node worker or a Durable Object hosts the same way.
- **Destroy with rescue.** `set(null)` mid-run commits the in-flight entry flagged `cancelled` with its patch and runs `save` before stopping.
