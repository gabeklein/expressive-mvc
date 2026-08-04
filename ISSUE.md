# MVC Followups — structural gaps found while spiking a three.js adapter

Source: `claude/threejs-expressive-wrapper-w9tn62` (`packages/three`, a spike — not
proposed for merge). Nothing here is a live bug in shipped code. Every item is a
**structural gap that current guidelines cover only tacitly**: the library's own
usage happens to stay inside the safe pattern, so the constraint was never written
down. Building a library base class that users extend is what surfaced them, and
that is a use case `skills/` does not address at all.

Each `##` section below is one draft item for **MVC Followups** (project `6`,
owner `gabeklein`). Splitter script at the end of this file.

---

## Instruction fields are not inherited — a subclass initializer silently disables them

**Finding.** Instructions are values, not declarations. `def()` mints a Symbol
token; `set`/`get`/`ref`/`has`/`map` all funnel through it. Field initializers run
base-first and (under `useDefineForClassFields`) each one `defineProperty`s an own
property, so a subclass initializer overwrites the base's token before anything
resolves it. At activation `def`'s handler scans own properties for tokens, finds
none, and the field silently becomes ordinary reactive state.

```ts
class Base extends State {
  source = 1;
  derived = set((self) => self.source * 10);   // 10
}
class Sub extends Base {
  derived = 0;                                  // stays 0 forever; no error
}
```

**Reproduced.** Probe against `packages/mvc` — instruction resolves once for the
base, zero times for the subclass. Also hit accidentally in the spike, where a
subclass `material = set(fn)` silently never reached its three.js object.

**Reachable in shipped code.** Latent, not firing. Only 7 instruction fields exist
on library classes. `Component.fallback = set(null)` is immune *by luck* — it
supplies a default, and a shadowing initializer produces exactly the same thing.
But `Route.router = set(() => …)` and `Route.query = set(() => …)` supply
**behavior**, and `Route` is explicitly an extendable compatibility contract, so
`class Checkout extends Route { query = … }` would silently detach it.

**Docs gap.** `skills/field/*.md` never states that instructions are per-instance
values rather than declarations, nor the rule the codebase implicitly follows: *a
base class may use instructions for defaults, never for behavior a subclass might
redeclare.* That rule is currently tacit and unenforced.

**Open.** Is detection feasible in core? Hard: a shadowed token leaves no trace on
the instance, so you would have to correlate tokens minted during a construction
against those consumed, and nested `new State()` in field initializers interleaves
that. Alternatives: document the rule, or provide a prototype-accessor pattern for
base classes (prototyped below, in the leak item's sibling).

---

## `def` token registry leaks every unconsumed instruction

**Finding.** `APPLY` in `packages/mvc/src/field/def.ts` is a strong
`Map<symbol, Factory>`; entries are deleted only when the token is found on an
instance. Field initializers run **per instance**, so each construction mints a new
Symbol and adds an entry. Two paths never consume it:

1. the instruction was shadowed by a subclass (see previous item);
2. the instance was constructed with plain `new` and never activated.

Either way the entry — and the closure it holds — is retained for the process
lifetime, one per instance constructed.

**Reproduced.** Probe confirming per-instance token minting (initializer runs 3×
for 3 instances) plus code inspection: `APPLY.set` on every `def()`, `APPLY.delete`
only inside the found-branch of the activation handler.

**Reachable in shipped code.** Yes, though currently bounded — the library's own
instruction fields are always consumed, and never-activated instances are rare
outside tests. Unbounded for any codebase that hits either path in a loop.

**Docs gap.** None applicable; this is an implementation defect, not a documented
contract.

**Open.** One-word fix: `Map` → `WeakMap`. These are unique `Symbol('field-…')`
values, not registered symbols, so they are valid WeakMap keys — verified on the
repo's Node 22. Worth confirming against the `engines` floor (Node ^20.19).

---

## No way to resolve "nearest ancestor of type by tree position"

**Finding.** `get(Type)` resolves through context, which does not mirror tree
position. A State adopted by `has()` or `map()` is registered in its **owner's**
context, so a lookup from a member can match a *sibling*; and two such siblings in
one context make the lookup ambiguous, where `Context.get` returns `null` — a
silent no-match rather than an error.

**Reproduced.** In the spike, a parent node with a two-member `has()` pool failed
to attach anything: the lookup from the parent found two non-explicit siblings and
resolved `null`. Worked around by walking the context chain manually for an entry
registered **explicitly** (which is what a Component does for itself), reading
`Context.provide` directly — no public API exposes that distinction.

**Reachable in shipped code.** Yes. Any `get(Type)` where the same type may be
adopted into a shared context is exposed. Unlikely in app code because types are
usually distinct; near-certain in a homogeneous tree (scene graph, org chart,
nested layout).

**Docs gap.** `skills/state/context.md` describes upstream/downstream lookup but
not that adopted members flatten into the owner's context. `skills/field/has.md`
and `map.md` say members are "parented to the owner" without noting the context
consequence. Neither mentions that ambiguity resolves to `null` silently.

**Open.** Should there be a public way to ask "nearest provider *above me in the
tree*", distinct from "any provider of this type in scope"? Also: should ambiguous
resolution warn rather than return `null`?

---

## `mount` is not called for a placed instance, so collection members never get it

**Finding.** `Component.mount` is skipped for an instance rendered as
`{component}` — which is precisely how a `has()` / `map()` collection renders
through the `$$typeof` facade. Any per-member commit-time setup registered in
`mount` therefore never runs for collection members.

**Reproduced.** In the spike, attaching scene nodes in `mount` worked for every
JSX-placed node and silently skipped all pool members. Fixed by moving the work to
activation, which covers every placement path but is no longer commit-timed.

**Reachable in shipped code.** Yes, in `@expressive/react`.

**Docs gap.** The JSDoc on `mount` does say it is not called for a placement. What
is missing is the consequence: `skills/field/has.md` advertises "a collection
renders directly — `<ul>{this.todos}</ul>`" with no note that members rendered this
way skip `mount`. The two facts are documented in different places and never
connected.

**Open.** Is there a commit-time hook that covers placements? If not, worth saying
so explicitly next to the direct-render feature.

---

## A computed's first value is asynchronous when first read during activation

**Finding.** A class getter (or arity-bearing `set(fn)`) that is first read during
activation is not yet connected, so the read throws a suspense promise and the
value resolves a microtask later. Reading one directly inside `new()` / a
`State.on` `before` or `after` handler throws a bare promise rather than returning
a value.

**Reproduced.** In the spike, an effect registered in `after` read a subclass
computed and got suspense; the derived value reached its target one microtask
later. Several tests need a microtask flush before their first assertion.

**Reachable in shipped code.** Yes.

**Docs gap.** `skills/state/computed.md` presents getters as plainly memoized and
synchronous. `skills/state/lifecycle.md` describes the activation phases without
noting that computeds are not yet readable during them. Nothing warns that a read
inside `new()` throws.

**Open.** Should a computed read during activation connect eagerly instead of
suspending? At minimum this belongs in `computed.md` and `lifecycle.md`.

---

## Subclass getters cannot override base-class fields (TypeScript)

**Finding.** The documented idiom — "declare a getter and it becomes a memoized
reactive property" — cannot be applied against a library base class that declares
the field as a property. TypeScript rejects it in both directions: property →
accessor is TS2611, accessor → property TS2610.

```ts
class Themed extends Mesh {
  get material() { … }   // TS2611 — Mesh declares `material` as a property
}
```

The runtime supports the override (mvc redefines the own property); only the type
system objects. The workaround is `material = set((self: Themed) => …)`, which
works but loses inference on `self`.

**Reproduced.** Isolated `tsc` probe covering both directions, plus the spike where
every derived wrapper field had to be rewritten as `set(fn)`.

**Reachable in shipped code.** Yes, for anyone extending a library class with
initialized fields.

**Docs gap.** `skills/state/computed.md` presents the getter idiom without
inheritance caveats. Nothing tells a base-class author that every initialized field
they declare forecloses the getter idiom in every subclass — a real design
constraint for `Route`, `Component`, and any future base.

**Open.** Worth a short "writing a base class others extend" section stating the
constraint and the `set(fn)` substitute.

---

## `State.on` handlers cannot reach `protected` members

**Finding.** `State.on` handlers are module-level functions outside the class, so
they cannot touch `protected` members — which is exactly what a base class needs
when its contract is "internals are protected, subclasses extend." The options are
to cast past your own contract or move the work into the constructor.

**Reproduced.** In the spike, `Object3D.on({ before })` could not call the
`protected create()` it was designed around. Resolved by moving construction into
the class constructor, which works but runs before subclass field initializers and
before props apply.

**Reachable in shipped code.** Yes — a design friction rather than a defect.

**Docs gap.** `skills/` has no guidance on authoring an extendable base class at
all: not `State.on` cadences vs. constructor, not what belongs protected, not the
ordering consequences of each choice.

**Open.** Should there be a sanctioned per-instance setup hook callable from inside
the class body, or is "use the constructor" the answer worth documenting?

---

## `Component` dedupes construction against a shared props object

**Finding.** `Component`'s constructor keys a `PENDING` map on the props object, so
constructing twice with the *same* props object returns the first instance rather
than a new one. A subclass constructor that allocates a resource will run its body
against the returned instance and can orphan the first allocation unless it guards.

**Reproduced.** `new Mesh(props); new Mesh(props)` with a shared `props` returns the
same instance. The spike needed an explicit `if (!TARGET.has(this))` guard to avoid
building and orphaning a second three.js object.

**Reachable in shipped code.** Yes, though the path is only reachable when a caller
reuses a props object before activation.

**Docs gap.** Undocumented entirely. `skills/react/component.md` covers props but
not the dedupe, and the behavior is surprising for anyone writing a subclass
constructor.

**Open.** Is the dedupe load-bearing for a host other than React? If it is
React-specific, does it belong in core `Component`?

---

## No public seam to push fresh props into a live Component

**Finding.** `Component.props` is `declare readonly`, yet assigning it is the
mechanism that re-merges props into state. An adapter that wants to hand new props
to an existing instance must cast past the public type:

```ts
(instance as { props: unknown }).props = props;
```

**Reproduced.** Required by the spike's reconciler before that reconciler was
dropped; still the only route for any non-React host.

**Reachable in shipped code.** Yes, latent — the shipped adapters go through React,
so nothing in-tree needs it today.

**Docs gap.** No adapter-authoring documentation exists, so neither the seam nor its
absence is described anywhere.

**Open.** Should props application be a method (`applyProps`) rather than a
writable-but-readonly-typed field?

---

## Effects created while a child activates leak into the parent's effect scope

**Finding.** When a child State is activated synchronously inside a parent's
`watch` callback, effects created during that activation register into the
**parent's** `EffectContext`. `watch`'s `cleanup` ignores its `update` argument, so
the parent's next run tears down every descendant effect permanently. Symptom:
children mount, render once, then go inert.

**Reproduced.** Hit while building the spike's reconciler. Fix was one line and
entirely undiscoverable:

```ts
capture(() => reconcile(fiber, content));
```

**Reachable in shipped code.** No. `@expressive/react` mounts children inside
React's render, never inside a parent's `watch`, so no shipped adapter hits it. Any
new host that reconciles synchronously will.

**Docs gap.** `capture` is exported from `@expressive/mvc/observable` and appears in
no skill doc. There is no adapter-authoring guide to put this in.

**Open.** Should `watch`'s cleanup honour its `update` argument so a stale pass does
not tear down nested scopes? Or should nested activation shield itself
automatically?

---

## One JSX host per build, at runtime and at type level

**Finding.** `host()` throws on a second registration, and `Host` is a single global
interface, so two adapters cannot share a build:

```
A different JSX host is already registered for @expressive/mvc.
error TS2717: Property 'node' must be of type 'Node', but here has type 'ReactNode'.
```

The type-level half is the sharper one: a package containing both a custom host and
anything importing `@expressive/react` needs **two separate TypeScript programs**.

**Reproduced.** Verified both halves — the runtime throw by importing both
adapters, TS2717 by putting a custom host and the React entry in one program. The
spike carried two tsconfigs until its own host was dropped.

**Reachable in shipped code.** Yes, and intentional — `runtime.ts` documents
one-host-per-build "by design."

**Docs gap.** The constraint is documented only in source JSDoc. `skills/` has
nothing on writing an adapter, so the practical consequence — you cannot mix a
custom host with React in one app — is undiscoverable before you hit it.

**Open.** Mostly a documentation item, unless mixed React + custom-host apps are a
target, in which case the singleton is the thing to revisit.

---

## `skills/` has no guide for authoring an adapter or an extendable base class

**Finding.** Umbrella item for the pattern behind most of the above. `skills/` is
written for *consumers* of the library. Nothing addresses the two roles this spike
occupied:

- **Adapter author** — `host()` / `HostRuntime`, the one-host rule, `capture` and
  effect scoping, `Context` push/pop per placement, how props reach an instance.
- **Base-class author** — instructions are values not declarations (so defaults
  only), initialized fields foreclose subclass getters, `State.on` cannot see
  protected members, which lifecycle slot runs before subclass field initializers.

Every constraint in this batch was discovered by reading `packages/mvc` source, and
each is a rule the codebase already follows tacitly.

**Reachable in shipped code.** N/A — documentation.

**Docs gap.** This *is* the gap.

**Open.** Is adapter authoring in scope for `skills/`, or does it belong in
`website/content/llm/` or a CONTRIBUTING-level doc? The base-class half seems
clearly in scope for `skills/`, since it governs anyone building on `Component`.

---

## Filing script

From a checkout, with `gh auth refresh -h github.com -s project` done once:

```bash
python3 - <<'PY'
import re, subprocess
doc = open('ISSUE.md').read()
body = doc.split('\n---\n', 1)[1]
items = re.split(r'\n## ', body)[1:]
for chunk in items:
    title, _, rest = chunk.partition('\n')
    title = title.strip()
    if title == 'Filing script':
        continue
    rest = rest.split('\n---')[0].strip()
    subprocess.run([
        'gh', 'project', 'item-create', '6',
        '--owner', 'gabeklein',
        '--title', title,
        '--body', rest
    ], check=True)
    print('filed:', title)
PY
```

`item-create` prints nothing and exits 0 on success. Verify with:

```bash
gh project item-list 6 --owner gabeklein --format json | \
  python3 -c "import sys,json;[print('-',i['content']['title']) for i in json.load(sys.stdin)['items']]"
```
