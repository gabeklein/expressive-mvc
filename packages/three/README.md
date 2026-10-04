# @expressive/three (spike)

A three.js scene graph built from Expressive MVC classes, composed with **plain
React JSX**. React mounts and unmounts the hierarchy; it never sees a value
change. Built on `main` with **no changes to any existing package.**

Not a proposal to ship. It exists to find out what the shape costs.

## The idea

React is the host, deliberately under-levered. It answers one question per node -
*does this exist, and where* - and the scene's values never touch the render
pipeline. Where r3f drills props through renders to reach scene memory, here a
class holds the three.js object it represents and passes a fixed set of that
object's members through as reactive fields: the object is the storage, a write
forwards straight to it and dispatches through the update system.

Actors find each other through the context hierarchy rather than props.

```tsx
class Spinner extends Mesh {
  frame = get(Frame);
  speed = 2;

  geometry = new THREE.BoxGeometry();
  material = new THREE.MeshStandardMaterial({ color: 'tomato' });

  /** Business logic an external actor calls. */
  boost(by: number) {
    this.speed += by;
  }

  protected new() {
    return this.frame.each((delta) => {
      this._object.rotation.y += this.speed * delta;
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

`spinner.position = [0, 2, 0]` reaches GPU memory and notifies reactive
consumers with **zero renders at any level** - asserted in the tests. Same for
`frame.each`, and for `boost()` called from anywhere holding the instance.

Extending a primitive is the norm: that is where custom properties and methods
for business logic live. A subclass declares defaults as ordinary fields
(`geometry = …` above) and they reach the object; a JSX prop or constructor
argument still overrides them. Internals - `_object`, `create` - are `protected`.

## How a primitive passes members through

Each class declares the members it owns and installs them itself, at `pre`:

```ts
Object3D.on({ pre: contract('visible', 'position', 'rotation', 'scale') });
Mesh.on({ pre: contract('geometry', 'material') });
```

`contract` defines each key with the public `state.set(key, { get, set })` - a
fully managed property (reads tracked, writes dispatched) whose storage is the
three.js object. Members three writes by copy (`position`, `rotation`, `scale`)
take a tuple and read back as one; an unchanged one dispatches nothing.

`pre` is the only stage that works:

| Where | Problem |
|---|---|
| constructor body | too early - a subclass field initializer runs after and replaces the key |
| `new()`, `super(…, callback)` | too late - activation has already made a subclass default plain state |
| `on({ pre })` | every initializer has run, nothing is observed yet |

At `pre` a subclass default is still a plain own value, so `contract` routes it to
the object. A subclass that redeclares a member with an instruction
(`geometry = set(self => …)`) throws: derive it in an effect instead.

The three.js object lives in an unmanaged `_object` field on the instance, so it
is off observed state and travels with the instance if its module re-runs under
hot reload, where a module-scoped `WeakMap` would be replaced (reasoned, not
probed). `Frame` keeps its handlers the same way.

## What the core provides

- **`Context` is host-independent**, so children resolve actors with `get(Type)`
  instead of receiving drilled props. This carries the design.
- **`state.set(key, { get, set })`** defines a managed property whose storage is
  somewhere else entirely. Public API; no instruction needed.
- **`State.on({ pre })`** runs after every field initializer and before values
  are observed - the window a vendor contract needs.
- **`_` fields are unmanaged** - the place for a handle like the three.js object.
- **Render composition** lives in core, so a subclass `render` wrapping `super`'s
  content works with no adapter involvement.
- **Destruction** (`set(null)`, `new()` cleanups) maps onto three's `dispose()`.
- **The React binding is ~25 lines** - no `jsxImportSource`, no reconciler, no
  `<Canvas>` owning a parallel tree.

## What it cost

Ranked by how much they'd shape the real thing.

### 1. Instruction fields were the wrong premise for a vendor base

An earlier revision exposed members through a `pass()` instruction field. Field
initializers run base-first, so a subclass default (`geometry = new
SphereGeometry()`) overwrote the instruction's token before it resolved - the
passthrough was silently never installed, and the mesh kept three's default.

The fix was not a better instruction. Instructions are a *user* tool, for mixing
behavior onto an otherwise complete stack of State behavior. A vendor base's
members are a fixed contract it already knows, so it installs them imperatively -
see above. That removes the overwrite entirely, with no core change.

The overwrite itself is real and library-wide: a base-class instruction carrying
behavior (`ref()`, `has()`, `get()`) is silently replaced by a subclass value.
Closing a class layer with an empty `def()` would fix it in core - scoped
separately; not needed here.

### 2. "Nearest ancestor in the graph" has no reliable lookup

`get(Object3D)` looks like the way to find the node you attach under. It is not:

- A State adopted by `has()` or `map()` is registered in its **owner's** context,
  so a lookup from it can match a *sibling*.
- Two such siblings in one context make it ambiguous and `Context.get` returns
  `null`, so a parent silently attaches nothing. Re-verified on `main`.

The binding instead walks the context chain for an `Object3D` registered
**explicitly** - what a Component does for itself, and what separates "the node
this context belongs to" from "nodes that merely live in it." That reads
`Context.provide` directly; there is no public API for resolve-by-tree-position.
It is the one place the spike reaches past the public surface.

### 3. `mount` is not called for a placed instance

`mount` is the natural commit hook for attachment, but it is skipped for an
instance rendered as `{component}` - exactly how a `has()` or `map()` collection
renders, so members would never join the graph.

So attachment happens at the `new` stage, which covers every placement path:

- A render attempt React later discards attaches first, and detaches when its
  context is popped.
- **Suspense does not gate existence.** A node whose `render` suspends is already
  in the graph while React shows a fallback (asserted in the tests). Gate an
  asset-dependent node at the call site instead.

### 4. A Component subclass is not assignable to its base

`Component.BaseProps.is` is a function-typed property, so it is contravariant: a
`Ball extends Mesh` is not assignable to `Mesh`, and any function taking a `Mesh`
rejects every subclass. Reproduced on `main` with plain `Component` subclasses;
`State` subclasses are unaffected. Declaring it method-style
(`is?(instance: T): void`) would make it bivariant. Since extending primitives is
the norm here, this bites constantly - the spike works around it with
`object`-typed helpers.

### 5. A computed field's first value is asynchronous

A getter (or `set(fn)`) first read during activation is not yet connected, so it
throws suspense and resolves a microtask later. Reading one directly inside
`new()` throws a bare promise rather than a value. Tests flush a microtask before
asserting on a computed.

### 6. Subclass getters cannot override base-class members (TypeScript)

The base declares `geometry` as a property, so a subclass `get geometry()` is
TS2611. `computed.md` documents the general rule.

### 7. Single inheritance forecloses the literal reading of the goal

`class Rig extends THREE.Mesh` is impossible - `State` must be in the prototype
chain. Classes *represent* a three object rather than being one, so `_object`
appears in every imperative method. Close in feel; not the same thing.

### 8. TypeScript cannot express asymmetric read/write on a property

`position` would ideally read as a live `Vector3` and accept a tuple. It cannot,
so passed-through vectors read as a tuple both ways, and a subclass uses
`this._object.position` for per-frame math. It also means `scale` takes
`[2, 2, 2]` rather than `2`.

## Dropped

- **A self-registering mvc JSX host** (`059313e`, `75a8189`). It worked, but any
  real app already renders a React entry point, and one host per build meant it
  could not share a TypeScript program with `@expressive/react`.
- **`pass()`** (`bb5e816`) - see cost 1.

The primitives stay host-agnostic - `object.ts` imports no host - but React is
the host in practice.

## Deliberately out of scope

Not limitations found, just unbuilt: `WebGLRenderer` and a canvas host (so the
spike stays WebGL-free and fully testable - wire a renderer against a `Scene` and
drive `Frame` with `loop`), the rest of three's member surface beyond
`visible`/`position`/`rotation`/`scale`/`geometry`/`material` and `lookAt`
(mechanical), `Component.catch` boundaries, raycasting and pointer events, and
hot reload, which `_object` is meant to survive but no probe exercises.

## Verified

`bun run test` here: 29 tests, 100% statements/branches/functions/lines, clean
typecheck, against `main` @ `0863b57`. Tests assert on real `THREE.Scene`
graphs: hierarchy, conditional existence, context resolution, owned collections,
destruction and disposal, member reads/writes/dispatch, subclass defaults
reaching the object and yielding to props, and both per-frame animation and value
writes causing **no React render**.

**No pixels were rendered.** There is no `WebGLRenderer` here, so nothing
verifies that a scene this builds draws correctly - only that the object graph
and the values on it are what they should be.
