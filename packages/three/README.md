# @expressive/three (spike)

A three.js scene graph built from Expressive MVC classes, composed with **plain
React JSX**. React mounts and unmounts the hierarchy; it never sees a value
change. **No changes to any existing package.**

Not a proposal to ship. It exists to find out what the shape costs.

## The idea

React is the host, deliberately under-levered. It answers one question per node -
*does this exist, and where* - and the scene's values never touch the render
pipeline. Where r3f drills props through renders to reach scene memory, here a
wrapper holds a reference to the three.js object it represents and exposes its
members as **reactive passthroughs**: the object is the storage, a write forwards
straight to it and dispatches through the update system.

Actors find each other through the context hierarchy rather than props.

```tsx
class Spinner extends Mesh {
  frame = get(Frame);
  speed = 2;

  protected create() {
    return new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ color: 'tomato' })
    );
  }

  /** Business logic an external actor calls. */
  boost(by: number) {
    this.speed += by;
  }

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

`spinner.position = [0, 2, 0]` reaches GPU memory and notifies reactive
consumers, with **zero renders at any level** - asserted in the tests. Same for
`frame.each`, and for `boost()` called from anywhere holding the instance.

Extending a primitive is the norm: that is where custom properties and methods
for business logic live. Everything internal to the contract - `object`,
`create` - is `protected`, so a subclass has it and outside code does not.

## What the core provides

- **`Context` is host-independent**, so children resolve actors with `get(Type)`
  instead of receiving drilled props. This is the piece that carries the design.
- **`def()` is enough to build `pass()`** - a reactive property whose storage is
  somewhere else entirely. ~40 lines, no core change.
- **Render composition** lives in core, so a subclass `render` wrapping `super`'s
  content works with no adapter involvement.
- **Destruction** (`set(null)`, `new()` cleanups) maps onto three's `dispose()`.
- **The React binding is ~25 lines** - no `jsxImportSource`, no reconciler, no
  `<Canvas>` owning a parallel tree.

## What it cost

Ranked by how much they'd shape the real thing.

### 1. A passthrough cannot be redeclared in a subclass

This is the sharpest edge, and it follows directly from "the object is the
storage." A base-class instruction field is just an own property holding a token
until it resolves - so **any** subclass initializer replaces it first, silently:

```ts
class Ball extends Mesh {
  geometry = new THREE.SphereGeometry();   // ordinary state; never reaches the object
  material = set((self) => ...);           // a computed; never reaches the object
}
```

Neither errors. `ball.geometry` reads back what you assigned, while the mesh
still has three's default. Defaults belong in `create`; derived values are
**assigned by an effect** rather than declared as a getter:

```ts
protected new() {
  return this.get(({ theme }) => {
    this.material = new THREE.MeshBasicMaterial({ color: theme.color });
  });
}
```

That inverts the library's usual "derivation is a getter" idiom, and it is worth
deciding whether `pass` should detect the shadowing and throw. Note the footgun
is **general to instructions**, not to `pass` - `has()`, `map()`, `get()` on a
base class are shadowed the same way, silently.

### 2. "Nearest ancestor in the graph" has no reliable lookup

`get(Object3D)` looks like the way to find the node you attach under. It is not:

- A State adopted by `has()` or `map()` is registered in its **owner's** context,
  so a lookup from it can match a *sibling*.
- Two such siblings in one context make it ambiguous and `Context.get` returns
  `null`, so a parent silently attaches nothing.

The binding instead walks the context chain for an `Object3D` registered
**explicitly** - which is what a Component does for itself, and what separates
"the node this context belongs to" from "nodes that merely live in it." That
reads `Context.provide` directly; there is no public API for
resolve-by-tree-position. It is the one place the spike reaches past the public
surface, and the finding most worth acting on.

### 3. `mount` is not called for a placed instance

`mount` is the natural commit hook for attachment, but it is skipped for an
instance rendered as `{component}` - exactly how a `has()` or `map()` collection
renders, so members would never join the graph.

So attachment happens at **activation**, which covers every placement path. Two
consequences:

- A render attempt React later discards attaches first, and detaches when its
  context is popped. (An attempt discarded and never superseded leaks - but it
  leaks the instance too, so that is pre-existing adapter behavior.)
- **Suspense does not gate existence.** A node whose `render` suspends is already
  in the graph while React shows a fallback (asserted in the tests). Gate an
  asset-dependent node at the call site instead - which is the intended idiom
  anyway.

### 4. Protected members are unreachable from `State.on`

`State.on` handlers live outside the class, so they cannot touch `protected`
members - which is precisely what a "contract" base class needs to do. Object
creation moved into the constructor to avoid casting past its own contract. That
works, and is arguably better OO, but it means `create` runs before subclass
field initializers and before props apply.

There is also a guard there worth knowing about: `Component` dedupes construction
against a pending props object, so a second `new Mesh(props)` with the same props
returns the first instance. Without a check, that path would build a second
three.js object and orphan the first.

### 5. A computed field's first value is asynchronous

A getter (or `set(fn)`) first read during activation is not yet connected, so it
throws suspense and resolves a microtask later. Reading one directly inside
`new()` throws a bare promise rather than a value. Tests flush a microtask before
asserting on a computed.

### 6. Subclass getters cannot override base-class fields (TypeScript)

Independent of the shadowing above, TypeScript rejects the override outright:

```ts
class Themed extends Mesh {
  get material() { ... }  // TS2611 - Mesh declares `material` as a property
}
```

Both directions error (property→accessor TS2611, accessor→property TS2610). So
the type system and the runtime agree here, for different reasons.

### 7. Single inheritance forecloses the literal reading of the goal

`class Rig extends THREE.Mesh` is impossible - `State` must be in the prototype
chain. Wrappers *represent* a three object rather than being one, so `this.object`
appears in every imperative method. Close in feel; not the same thing.

### 8. TypeScript cannot express asymmetric read/write on a property

`position` would ideally read as a live `Vector3` and accept a tuple. It cannot,
so passthrough vectors read as a tuple snapshot both ways, and a subclass uses
`this.object.position` for per-frame math. Fine in practice - reads are for
reactive consumers, not frame loops - but it is a forced choice, and it means
`scale` takes `[2, 2, 2]` rather than `2`.

## Dropped

The self-registering mvc JSX host from earlier commits is **gone** (see `61f9f9e`
and `52b5fb4` if it is ever wanted as a fallback). It worked, but it bought
little: any real app already renders a React entry point, and one host per build
meant it could not share a TypeScript program with `@expressive/react` at all -
`Host.node` cannot be both `Three.Node` and `ReactNode`. Dropping it removed a
whole reconciler, a second tsconfig, and the constraint.

The primitives stay host-agnostic - `object.ts` and `pass.ts` import no host -
but React is the host in practice.

## Deliberately out of scope

Not limitations found, just unbuilt: `WebGLRenderer` and a canvas host (so the
spike stays WebGL-free and fully testable - wire a renderer against a `Scene` and
drive `Frame` with `loop`), the rest of three's member surface beyond
`visible`/`position`/`rotation`/`scale`/`geometry`/`material` and `lookAt`
(mechanical), `Component.catch` boundaries, raycasting and pointer events.

## Verified

`bun run test` here: 27 tests, 100% statements/branches/functions/lines, clean
typecheck. Tests assert on real `THREE.Scene` graphs, covering hierarchy,
conditional existence, context resolution, owned collections, destruction and
disposal, passthrough reads/writes/dispatch, the shadowing contract, and both
per-frame animation and value writes causing **no React render**.

**No pixels were rendered.** There is no `WebGLRenderer` here, so nothing
verifies that a scene this builds draws correctly - only that the object graph
and the values on it are what they should be.
