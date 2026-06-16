# PLAN: core subcomponents — migrate adapter render machinery into mvc

> Experiment branch. Builds on two pieces of work:
> - **#143** (merged) — `State.on` now takes a stage-keyed handler object
>   `{ type, before, after }`. The `type` stage (per-class, at bootstrap) is the
>   seam this experiment consumes.
> - **#117** `claude/preact-parity` — the preact adapter, whose `render`-restore
>   hack and second-walk subcomponent promotion are the patterns this experiment
>   retires. This branch is rebased on top of parity.
>
> This will eventuate to its own PR, landing **after** preact parity (#117).

## The problem this experiment probes

Both adapters (`packages/react`, `packages/preact`) classify a `Component`'s
members in two passes:

1. **mvc `bootstrap`** walks the prototype and reactively binds every method /
   getter — including `render` and capitalized methods that were never meant to
   be reactive state.
2. **The adapter then undoes / re-promotes**, via `Component.on(subcomponents)`,
   a *second* walk of the whole prototype chain that:
   - re-defines every capitalized key as a subcomponent
     (`defineSubcomponent`, `packages/*/src/seam.ts`), and
   - in preact, **restores `render`** from the reactive accessor bootstrap
     installed back to a plain method, because preact reads `T.prototype.render`
     with the prototype as receiver on every diff
     (`packages/preact/src/component.ts`, the `render`-restore comment block).

So `render` and `Capitalized` members get bound by core and then immediately
un-bound / re-shaped by the adapter — a walk + undo per class. The preact
`render` stub + restore is the most fragile instance of it.

## The seam (#143)

`State.on` hooks class-setup stages, not just per-instance `before`:

```ts
State.on({
  type(type)   { /* per-class, once at bootstrap, BEFORE members are
                    classified; receives the class so a handler may reshape
                    the prototype first. Base handler reaches subclasses. */ },
  before(self) { /* per-instance, in prepare, before observe/new() */ },
  after(self)  { /* per-instance, at the new() slot */ },
})
```

The `type` stage runs at the exact point bootstrap is about to classify a
class's members. Paired with #143's companion rule — **bootstrap skips a
non-configurable own member** — a `type` handler can *prevent* a reactive bind
rather than reverse one: seal a member in `type`, and bootstrap leaves it alone.
That is the whole leverage this experiment needed.

## Hypothesis

Replace the post-hoc `Component.on(subcomponents)` second walk with a `type`
handler that reshapes the prototype at bootstrap:

- Seal `render` → bootstrap skips it → it stays a plain prototype method, so the
  preact `render`-restore hack disappears and react's `render` override
  simplifies.
- Rewrite each capitalized prototype method into a subcomponent (`defineSubcomponent`,
  which also seals it) → bootstrap skips it instead of binding-then-replacing.
- The shared subcomponent logic is a candidate to migrate into `@expressive/mvc`
  core once the adapters stop driving the second walk themselves — "subcomponents
  in core".

## Results (spike complete)

The `subcomponents` walk is gone from both adapters; classification is driven by
a single shared `State.On` handler, registered with `Component.on(subcomponents)`
by each adapter.

**The handler (one object, two stages):**

```ts
export const subcomponents: State.On = {
  type(type) {
    seal(type.prototype, 'render');     // non-configurable → bootstrap skips it
    promote(type.prototype, false);     // capitalized methods → subcomponents (sealed)
  },
  before: (self) => promote(self, true) // per-instance: capitalized function fields
};
```

`seal` flips a prototype method to `configurable: false`; `promote` walks
own-prop names and hands each capitalized function to `defineSubcomponent`.
Capitalized *getters* are intentionally not claimed — nothing treats a
capitalized getter as a subcomponent, so one falls through to bootstrap's
default and binds as an ordinary reactive computed (verified: `get Double()`
reads as a value and tracks its deps, not rendered as `<Double/>`). The
convention is "capitalized *method* (or function field) = subcomponent."

**What the `type` stage + skip-non-configurable bought:**

- **No second prototype walk, no `SEEN` cache.** Bootstrap already walks the
  chain base→derived; the `type` handler reshapes each class once at that point.
  Both adapters deleted their `do…while (getPrototypeOf)` walk and the
  module-level `WeakSet` that dedup'd it.
- **No bind-then-undo.** Sealed members are never reactively bound and then
  replaced — bootstrap skips a non-configurable member, so the sealed `render`
  and the sealed subcomponents are left exactly as the handler shaped them.
  `defineSubcomponent` no longer reads back a bootstrap-installed accessor.
- **The preact `render`-restore hack is gone.** A sealed `render` stays a plain
  prototype method, which is exactly what preact's `prototype.render` class-check
  wants and what mvc's render CHAIN already consumes
  (`unbind(desc.get || desc.value)`). The `unbind(render.get)` restore block and
  preact's now-unused `unbind` import were removed. (The base render-less stub
  stays — it answers preact's check for components that define no `render` at all.)
- **One shared definition.** The logic was identical in both adapters; it now
  lives once and is re-exported via `@expressive/react/state`.

**What it did *not* eliminate — the residual per-instance bit:**

- A capitalized **function assigned as an instance field** (`Sidebar = Sidebar`
  to inject/override one) is inherently per-instance — class-field init uses
  `[[DefineOwnProperty]]`, bypassing the prototype, so a bootstrap-time `type`
  reshape can't see it. This is the one case that still needs a per-instance
  pass, expressed as the handler's `before` stage (`promote(self, true)` — walks
  *instance own* props only, no prototype chain, no cache). The object overload
  let this fold into the *same* handler rather than a second `Component.on`.

**Net:** two duplicated prototype-chain walks + the preact `render`-restore hack
deleted from the adapters, replaced by one shared `State.On` handler. mvc 488 /
react 204 / router 157 / preact 180 — all pass, tsc + build clean.

## Collapsing the walk into core (original intent)

A stated goal was to collapse the adapter's discovery **walk** (not the component
implementation) into core. Status:

- **Per-class walk: collapsed (done).** The old discovery walk was the
  `do…while (getPrototypeOf)` loop in each adapter's `component.ts`, deduped by a
  module-level `SEEN` WeakSet. Both are deleted. Bootstrap walks the chain
  base→derived; the `type` handler rides that walk, reshaping each class once.
  The adapter no longer iterates the prototype chain — core owns that walk.
- **Per-instance walk: not collapsed (the remaining gap).** The `before` stage
  still walks instance own-props to promote a capitalized function assigned as a
  field. But core *already* walks instance own-props in `observe()`
  (`for (key in state) … apply(...)`), so this is a duplicate walk. Closing it
  needs the instance-phase analogue of what #143 added at the class phase: a
  **per-key claim hook in `observe()`** (a `field(self, key, desc)` stage,
  claim-or-pass before `apply`). With that, the `before` walk deletes.
- **Policy** (capitalized = subcomponent, `render` = skip) still lives in the
  adapter handler. Moving it to core would mean core's `Component` registering
  the policy itself and calling an injected molecule
  (`Component.subcomponent = defineSubcomponent`). Defensible — the convention is
  a Component-model concept, not a React-ism — but a larger commitment, and
  separable from the walk question.

**Decision:** instance-phase walk left as-is for now (gated on a new core
`field` stage in `observe`). The *policy-to-core* question is also deferred.

### `Runtime.component` — the host molecule behind the registry (done)

Intermediate step taken instead of moving the subcomponent contract to core: the
host-specific half of the molecule now lives on the `Runtime` registry, beside
the other host seams (`createElement`, the hooks, `Suspense`).

```ts
// runtime.ts — pre-populated default, shared by the hook adapters
Runtime.component(owner, render) =
  (props) => render().call(useHook((set) => watch(owner, set)) || owner, props);
```

- `defineSubcomponent` shrank to pure, host-agnostic descriptor plumbing — claim
  the original method, cache the host component on the owner, expose the override
  setter — and delegates the reactive binding to `Runtime.component`. It no
  longer imports `useHook`/`watch`.
- The default is pre-populated on the `Runtime` object, so preact (which only
  `Object.assign`s the host *primitives*) inherits it for free; a non-hook
  adapter (Solid) overrides it with `Object.assign(Runtime, { component })` and
  reuses the same walk + `defineSubcomponent` unchanged.
- This is the seam that makes a later "subcomponent contract in core" cheap
  *without committing to it now*: the only host dependency the walk has left is
  `Runtime.component`, already an overridable registry entry. Core does not yet
  know about subcomponents; nothing moved into mvc.

### `seam.ts` collapsed into `runtime.ts` (done)

**Decision: this stays a react-package concern, not a core one** — no core
subcomponent contract, no new `Component`/`Runtime` public method. `seam.ts` is
gone; its pieces moved into `runtime.ts`:

- `Runtime.component` *implements* the actual subcomponent (host molecule).
- `defineSubcomponent` (private) is the host-agnostic descriptor plumbing that
  caches it on the owner.
- `subcomponents` (the `State.on` handler) is what *bootstraps* them within the
  host component's own class/instance setup — the integration point, not a core
  stage.
- `intercept` (host own-property guard) lives here too as shared host plumbing.

`state.ts` and both `component.ts` files re-point their `intercept`/
`subcomponents` imports to `./runtime`; preact is unaffected (still via
`@expressive/react/state`). No public surface changed — same exports, one fewer
module.

**Step 3 (subcomponents fully into mvc core) — finding:** the `type` reshape is
the right *recognition* point and is already host-agnostic, so the half that says
"this member is a subcomponent" is core-ready today. What is *not* core-ready is
the *binding molecule* `defineSubcomponent` constructs: subscribe to the owner →
render with it as `this` → clean up on unmount. Each adapter implements that
molecule in its own idiom (react/preact via hooks, Solid via signals +
`onCleanup`), so core must seam the **molecule as a whole**, not a narrower hook
primitive — baking `useHook` into core would impose a React-ism on adapters
(Solid) that have no hooks. So "core subcomponents" is recognition (core, done
here) + a host-supplied binding molecule (the seam still to design); this PR
delivers the first half.

**Step 4 (`SLOTS` render-attempt stacking) — finding:** independent of this
change. The react `SLOTS`/`register`/`commit` machinery keys off committed vs.
in-flight render attempts per ambient context; it does not touch member
classification and was untouched here. Disentangling it is a separate effort.

## Verdict on the `State.on` overload (regardless of core migration)

It bore fruit, and the value concentrates in **`type` plus the
skip-non-configurable rule**: together they are the first seam that lets an
adapter *prevent* a reactive bind rather than reverse one. That single capability
deletes the preact `render`-restore hack and the bind-then-undo subcomponent
walk — a standalone adapter simplification that holds even if subcomponents never
move to core. `before` as an object key is not new power (it is the old
bare-function behavior, just co-located so one registration covers per-class +
per-instance). `after` was unused here. So of the three stages, `type` is the
load-bearing one for this consumer — a useful signal for how much of the #143
surface is actually exercised today.

## Out of scope

- Final PR polish (changeset, docs) — added when the shape settles.
- Solid adapter (#116) subcomponent bridge — follow-up if the core seam lands.
- Core instance-phase `field` claim hook in `observe()` — the prerequisite for
  collapsing the per-instance `before` walk.
