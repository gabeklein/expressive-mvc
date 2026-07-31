# @expressive/three (spike)

A three.js scene graph driven by Expressive MVC classes. JSX declares hierarchy
and gates existence; behavior lives imperatively in subclasses of primitive
wrappers. **No changes to any existing package.**

Not a proposal to ship. It exists to answer whether the core is actually
host-agnostic, and to record what it costs.

## Two hosts, one set of primitives

`Object3D`, `Group`, `Mesh`, `Scene` and `Frame` know nothing about a host. Pick
how existence gets gated:

```ts
import { Group, Mesh } from '@expressive/three/react';   // React composes
import { render } from '@expressive/three/native';       // mvc is the host
```

**`@expressive/three/react` is the one to reach for inside a React app.** It is
plain React JSX - no `jsxImportSource`, no reconciler, no `<Canvas>` wrapper
owning a parallel tree. React contributes hierarchy and existence; nothing else
about a scene rides the render pipeline. The whole adapter is ~25 lines.

```tsx
class Spinner extends Mesh {
  frame = get(Frame);
  speed = 2;

  geometry = new THREE.BoxGeometry();
  material = new THREE.MeshStandardMaterial({ color: 'tomato' });

  protected new() {
    return this.frame.each((delta) => {
      this.object.rotation.y += this.speed * delta;
    });
  }
}

function View() {
  const { ready } = Session.get();

  return (
    <Scene>
      <Ground />
      {ready && <Spinner position={[0, 1, 0]} />}
    </Scene>
  );
}
```

JSX carries three things and nothing else: what exists, where it sits, and
whether it exists at all. Everything a `Spinner` *does* is on the class, and
`frame.each` moves it with no render at any level - asserted in the tests.

`@expressive/three/native` registers mvc as the JSX host instead, for a
standalone 3D app with no React in the build. It gains one thing React cannot
give: because `watch` absorbs a thrown promise, a node whose `render` reads an
unresolved value stays **out of the graph entirely** until the value arrives.

## What the core already provides

Nothing here required a core change.

- **`Host` / `HostRuntime`** is a genuine adapter seam. The whole element layer
  for the native host is ~40 lines in `node.ts`, and leaving `Host.intrinsics`
  unaugmented makes `JSX.IntrinsicElements` `{}` - so every tag *must* be a
  class. The desired bias falls out of the existing design.
- **`Context`** is host-independent, so children resolve state with `get(Type)`
  instead of receiving drilled props - identically under both hosts.
- **Render composition** lives in core, so a subclass `render` wrapping `super`'s
  content via the lazy `children` getter works with no adapter involvement.
- **Destruction** (`set(null)`, `new()` cleanups) maps cleanly onto three's
  `dispose()`. Unmount-time resource release is a lifecycle the library owns.
- **A scene graph needs no reordering pass** - sibling order is not observable -
  so fibers really can be existence-only. `fiber.ts` is ~140 lines.

## What it cost

Ranked by how much they'd shape a real adapter.

### 1. One host per build - which is why the React path matters

`host()` throws on a second registration, and `Host` is a single global
interface. Both halves are real:

```
A different JSX host is already registered for @expressive/mvc.
error TS2717: Property 'node' must be of type 'Node', but here has type 'ReactNode'.
```

This package needs **two tsconfigs** because the native host and the React entry
cannot occupy one TypeScript program. That is the constraint, made concrete.

It is not a problem for `@expressive/three/react`, which never registers a host -
React is the host. The native entry is for builds with no React at all.

### 2. "Nearest ancestor in the graph" has no reliable lookup

`get(Object3D)` looks like the way to find the node you attach under. It is not:

- A State adopted by `has()` or `map()` is registered in its **owner's** context,
  so a type lookup from it can match a *sibling*.
- Two such siblings in one context make the lookup ambiguous, and `Context.get`
  returns `null` - so a parent silently fails to attach anything.

The native host sidesteps this by walking its own fiber tree. The React entry has
no tree to walk, so it walks the context chain looking for an `Object3D`
registered **explicitly** - which is what a Component does for itself, and what
distinguishes "the node this context belongs to" from "nodes that live in it".
That reads `Context.provide` directly; there is no public API for
resolve-by-tree-position.

This is the one place the spike reaches past the public surface, and the finding
worth acting on.

### 3. `mount` is not called for a placed instance

`mount` is the natural commit hook for attachment, but it is skipped for an
instance rendered as `{component}` - which is exactly how a `has()` or `map()`
collection renders. Members would never join the graph.

So the React entry attaches at **activation** instead, which covers every
placement path. The cost: attachment happens during React's render pass, so a
render attempt React later discards attaches first and detaches when its context
is popped. (An attempt discarded and never superseded would leak - but it leaks
the instance too, so that is pre-existing adapter behavior, not new.)

### 4. Activation order: a spawned member outruns its owner

A member spawned by `has()` inside its owner's `new()` activates *immediately* -
before the owner reaches its own `new()` slot. Attachment from the member then
finds an owner whose `object` does not exist yet.

Fixed by creating the three.js object in `before` rather than at the `new()`
slot. Consequence: props are not applied that early, so `create` cannot read
them - fields drive the object through effects instead of through construction.
That happens to be the intended style anyway, but it is a constraint, not a
choice.

### 5. Effects leak out of a child into the parent's render scope

Mounting a child State synchronously inside a parent's `watch` callback
registers the child's effect cleanups into the **parent's** `EffectContext`.
`watch`'s `cleanup` ignores its `update` argument, so the parent's next render
tears down every descendant effect permanently. Symptom: children mount, render
once, then go inert.

One line, and undiscoverable:

```ts
capture(() => reconcile(fiber, content));
```

Native-host only - React mounts children inside its own render - but any new
reconciler will hit it.

### 6. A computed field's first value is asynchronous

A class getter (or `set(fn)`) first read during activation is not yet connected,
so it throws suspense and resolves a microtask later. Reading one directly in
`new()` / `before` / `after` throws a bare suspense promise rather than a value,
and a derived field does not reach its three.js object synchronously on mount -
several tests flush a microtask before their first assertion.

### 7. Subclass getters cannot override base-class fields (TypeScript)

The documented idiom - "declare a getter and it becomes a memoized reactive
property" - breaks against a library-provided base class:

```ts
class Themed extends Mesh {
  get material() { ... }  // TS2611 - Mesh declares `material` as a property
}
```

Runtime is fine; TypeScript rejects it in both directions (property→accessor is
TS2611, accessor→property TS2610). The `set` factory substitutes, at the cost of
inference:

```ts
material = set((self: Themed) => new THREE.MeshBasicMaterial({ ... }));
```

This shapes wrapper design directly: base classes should expose as few
initialized fields as possible, because each one forecloses the getter idiom in
every subclass.

### 8. No seam for pushing fresh props into a live Component

`props` is `declare readonly`, yet assigning it is what re-merges props into
state, so the native reconciler casts:

```ts
(instance as { props: unknown }).props = props;
```

### 9. Single inheritance forecloses the literal reading of the goal

"Extensions of primitive classes" cannot mean `class Rig extends THREE.Mesh` -
`State` must be in the prototype chain. Wrappers *own* a three object
(`this.object`) and users extend `Mesh`/`Group`. Close in feel, but it is
composition wearing inheritance's clothes, and `this.object` appears in every
imperative method.

## Deliberately out of scope

Not limitations discovered - just unbuilt: `WebGLRenderer` and a canvas host (so
the spike stays WebGL-free and fully testable - wire your own renderer against a
`Scene`'s `object` and drive `Frame` with `loop`), `Component.catch` error
boundaries, PascalCase subcomponent promotion, raycasting and pointer events, and
prop-level diffing of three objects.

## Verified

`bun run test` here: 44 tests, 100% statements/branches/functions/lines, both
TypeScript programs clean. Tests build real `THREE.Scene` graphs and assert on
`scene.children` under **both** hosts, covering hierarchy, conditional
existence, context resolution, owned collections, destruction/disposal, suspense
gating (native), and per-frame animation with no render.

**No pixels were rendered.** There is no `WebGLRenderer` here, so nothing
verifies that a scene this builds draws correctly - only that the object graph
is the intended shape.
