# @expressive/three (spike)

A three.js scene graph driven by Expressive MVC classes, with **no React and no
changes to `packages/mvc`**. JSX declares hierarchy and gates existence; behavior
lives imperatively in subclasses of primitive wrappers.

Not a proposal to ship. It exists to answer whether the core is actually
host-agnostic, and to record what it costs.

## The premise

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

class World extends Group {
  frame = new Frame();
  session = get(Session);

  render() {
    return (
      <>
        <Ground />
        {this.session.ready && <Spinner position={[0, 1, 0]} />}
      </>
    );
  }
}

const scene = new THREE.Scene();
const done = render(<World />, scene);
```

JSX carries three things and nothing else: what exists, where it sits, and
whether it exists at all. Everything a `Spinner` *does* is on the class.

## What the core already provides

Nothing here required a core change. Contributing pieces, in order of how much
they mattered:

- **`Host` / `HostRuntime`** (`@expressive/mvc/runtime`) is a genuine adapter
  seam. Registering `jsx`/`jsxs`/`Fragment`/`childrenOf`/`typeOf`/`propsOf`
  is the entire element layer - about 40 lines in `node.ts`.
- **`Host.intrinsics` left unaugmented** means `JSX.IntrinsicElements` stays
  `{}` - every tag must be a class. That is exactly the desired bias, and it
  falls out of the existing design rather than being bolted on.
- **`Context`** is completely host-independent. `new Context(parent)` per
  placement is all context propagation takes, so children use `get(Type)`
  instead of receiving drilled props.
- **Render composition** lives in core `component.ts`, so a subclass `render`
  wrapping `super`'s content via the lazy `children` getter works with no
  adapter involvement.
- **`watch` absorbing a thrown promise** gives suspense-gated existence for
  free: a component whose `render` reads an unresolved value contributes
  *nothing* to the graph, then appears when the value arrives.
- **Destruction** (`state.set(null)` and `new()` cleanups) maps cleanly onto
  three's `dispose()`. Unmount-time resource release is a lifecycle the library
  already owns.

The domain also removes work a DOM reconciler must do: sibling order is not
observable in a scene graph, so there is no reordering pass. Fibers really can
be existence-only. `fiber.ts` is ~110 lines total.

## What it cost

Ranked by how much they'd shape a real adapter.

### 1. One host per build - blocking for mixed React + 3D

`host()` throws on a second registration, and `Host` is a single global
interface. Verified by importing both adapters in one build:

```
A different JSX host is already registered for @expressive/mvc.
```

A pure-3D app (game, viewer, installation) is fine. **A 3D view inside a React
app is not** - which is most of what R3F is used for. Two ways out, neither
taken here:

- Skip `host()` entirely: ship `@expressive/three/jsx-runtime` and set
  `jsxImportSource` per-file, leaving the mvc host free for React. Costs the
  shared `Component.Node` type, which would then be React's.
- Or teach core to carry more than one host.

Worth deciding deliberately, because it decides whether this is a niche
renderer or a general one.

### 2. Effects leak out of a child into the parent's render scope

Mounting a child State synchronously inside a parent's `watch` callback
registers the child's effect cleanups into the **parent's** `EffectContext`.
`watch`'s `cleanup` ignores the `update` argument, so the parent's next render
tears down every descendant effect permanently. Symptom: children mount, render
once, then go inert.

The fix is one line, but it is not discoverable:

```ts
capture(() => reconcile(fiber, content));
```

The React adapter never hits this because children mount inside React's render,
not inside the parent's effect. Any new adapter will.

### 3. A computed field's first value is asynchronous

A class getter (or `set(fn)`) first read during activation is not yet connected,
so it throws suspense and resolves a microtask later. Consequences:

- Reading a computed directly inside `new()` / `before` / `after` throws a bare
  suspense promise, not a value.
- An effect reading one gets the value on a later tick, so a derived field does
  not reach its three.js object synchronously on mount. Several tests need a
  microtask flush before their first assertion.

Fine for a scene graph; a sharp edge for anything that must be correct on frame
zero.

### 4. Subclass getters cannot override base-class fields (TypeScript)

The documented idiom is "declare a getter and it becomes a memoized reactive
property." That breaks against a library-provided base class:

```ts
class Themed extends Mesh {
  get material() { ... }  // TS2611 - Mesh declares `material` as a property
}
```

Runtime is fine - mvc redefines the own property - but TypeScript rejects it,
in both directions (property→accessor is TS2611, accessor→property is TS2610).
The `set` factory is the working substitute, at the cost of inference:

```ts
material = set((self: Themed) => new THREE.MeshBasicMaterial({ ... }));
```

This directly shapes wrapper design: base classes should expose as few
initialized fields as possible, because every one forecloses the getter idiom
in every subclass.

### 5. No seam for pushing fresh props into a live Component

`props` is `declare readonly`, yet assigning it is what re-merges props into
state. An adapter must cast:

```ts
(instance as { props: unknown }).props = props;
```

Minor, but it is the one place an adapter has to reach past the public surface.

### 6. Single inheritance forecloses the literal reading of the goal

"Extensions of primitive classes" cannot mean `class Rig extends THREE.Mesh` -
`State` must be in the prototype chain. So the wrapper *owns* a three object
(`this.object`) and users extend `Mesh`/`Group` rather than three's classes.
Close in feel, but it is composition wearing inheritance's clothes, and
`this.object` shows up in every imperative method.

## Deliberately out of scope

Not limitations discovered - just unbuilt: `WebGLRenderer` and a canvas host
(so the spike stays WebGL-free and fully testable), `Component.catch` error
boundaries, PascalCase subcomponent promotion (a React-adapter feature, not
core), raycasting and pointer events, and prop-level diffing of three objects.

## Verified

`bun run test` in this package: 36 tests, 100% statements/branches/functions/lines.
Tests build real `THREE.Scene` graphs and assert on `scene.children`, so the
reconciler, context propagation, suspense gating, destruction and the frame loop
are all exercised for real.

**No pixels were rendered.** There is no `WebGLRenderer` here, so nothing
verifies that a scene this builds draws correctly - only that the object graph
is the intended shape.
