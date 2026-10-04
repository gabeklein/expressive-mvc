# @expressive/three (spike)

A three.js scene graph built from Expressive MVC `State` classes. Ownership is
the hierarchy and the lifecycle is existence - there is no render pass, and a
scene's values never touch one. Built on `main` with **no changes to any existing
package**, but reaching one internal export (cost 2).

Not a proposal to ship. It exists to find out what the shape costs.

## The idea

A class holds the three.js object it represents and passes a fixed set of that
object's members through as reactive fields: the object is the storage, a write
forwards straight to it and dispatches through the update system. Where r3f
drills props through renders to reach scene memory, here a write *is* the update.

Actors find each other through context rather than props. Extending a primitive
is the norm - that is where custom properties and methods for business logic
live.

```ts
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

class World extends Scene {
  frame = new Frame();
  ground = new Mesh();
  spinner?: Spinner = undefined;

  start() {
    this.spinner = new Spinner({ position: [0, 1, 0] });
  }
}
```

`spinner.position = [0, 2, 0]` reaches GPU memory and notifies reactive
consumers. `frame.each` moves it with no update dispatched - asserted in the
tests. A subclass declares defaults as ordinary fields (`geometry = …` above);
constructor arguments still override them. Internals - `_object`, `create` - are
`protected`.

## Hierarchy is ownership

A node joins under the nearest `Object3D` that owns it and leaves when it is
destroyed:

- **Fields and pools** - `ground = new Mesh()`, `rocks = has(Mesh)` - are owned.
  Owners in between that are not scene objects (a `Level extends State`) are
  passed through.
- **References are not children.** A `player = get(Player)` field points at a node
  owned elsewhere; it stays where its owner put it.
- **Existence is the ownership lifecycle.** Assigning `this.lamp = new Lamp()`
  attaches it; `this.lamp = undefined` destroys and detaches it. `has()` add and
  delete do the same. Gating is ordinary state, not conditional rendering.

JSX is not needed to compose a scene. It could return as an optional layer -
`@expressive/dom` renders any `State` as an element, React provides one through
`<Component for>` - but a JSX placement is not ownership, so either would need its
own attachment (the dropped React binding walked context for it).

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

- **Ownership is tracked exactly** - fields, pools, late assignment, guest
  exclusion - and destroys owned children with their owner. The scene graph is a
  view of it.
- **`state.set(key, { get, set })`** defines a managed property whose storage is
  somewhere else entirely. Public API; no instruction needed.
- **`State.on({ pre })`** runs after every field initializer and before values
  are observed - the window a vendor contract needs.
- **`_` fields are unmanaged** - the place for a handle like the three.js object.
- **`Context`** lets actors resolve each other with `get(Type)` instead of props.
- **Destruction** (`set(null)`, `new()` cleanups) maps onto three's `dispose()`.

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
see above.

The overwrite itself is real and library-wide: a base-class instruction carrying
behavior (`ref()`, `has()`, `get()`) is silently replaced by a subclass value.
Closing a class layer with an empty `def()` would fix it in core - written up
separately; not needed here.

### 2. Ownership is not public

Core records each State's owner exactly (`parent()` in `state.ts`) but exports
neither it nor the owner's children. The spike imports it from the internal
module, so the build emits `import { parent } from "@expressive/mvc/state"` - a
subpath `@expressive/mvc`'s `exports` map does not allow. It works inside the
monorepo and would fail for any outside consumer.

Context cannot stand in. An adopted child is registered in its owner's context,
so an owner, its children and their siblings share one context, and a type lookup
there can match a sibling - or return `null` once two siblings make it ambiguous.

`@expressive/inspect` hits the same wall: it rebuilds ownership by scanning every
State's fields, where a `get()` reference is indistinguishable from an owned
child. A public owner accessor would serve both.

### 3. An instance the scene did not create cannot be placed

Ownership excludes guests by design - an already-active instance assigned to a
field stays where its owner put it. So there is no way yet to show one node under
two parents, or to place an externally constructed one. An imperative
`add(node)` would be the next primitive.

### 4. A Component subclass is not assignable to its base

Moving to `State` sidesteps it here, but it is a core finding:
`Component.BaseProps.is` is a function-typed property, so it is contravariant,
and a `Ball extends Mesh` built on `Component` is not assignable to `Mesh`.
Reproduced on `main`; `State` subclasses are unaffected. Declaring it method-style
(`is?(instance: T): void`) would make it bivariant.

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
appears in every imperative method.

### 8. TypeScript cannot express asymmetric read/write on a property

`position` would ideally read as a live `Vector3` and accept a tuple. It cannot,
so passed-through vectors read as a tuple both ways, and a subclass uses
`this._object.position` for per-frame math. It also means `scale` takes
`[2, 2, 2]` rather than `2`.

## Dropped

- **A self-registering mvc JSX host** (`059313e`, `75a8189`). Any real app already
  renders a React entry point, and one host per build meant it could not share a
  TypeScript program with `@expressive/react`.
- **`pass()`** (`bb5e816`) - see cost 1.
- **The React binding** (`27e1783`) - JSX composition is not integral here. Its
  findings stand for any React-hosted variant: `mount` is skipped for an instance
  placed as `{instance}` (so `has()` members never get it), and a suspended node
  is already in the graph while React shows a fallback.

## Deliberately out of scope

Not limitations found, just unbuilt: `WebGLRenderer` and a canvas host (so the
spike stays WebGL-free and fully testable - wire a renderer against a `Scene` and
drive `Frame` with `loop`), the rest of three's member surface beyond
`visible`/`position`/`rotation`/`scale`/`geometry`/`material` and `lookAt`
(mechanical), JSX composition, raycasting and pointer events, and hot reload.

## Verified

`bun run test` here: 30 tests, 100% statements/branches/functions/lines, clean
typecheck, against `main` @ `0863b57`. Tests assert on real `THREE.Scene`
graphs: hierarchy from fields, pools and intermediate owners; references and
guests left out; existence following field assignment and pool deletion;
destruction and disposal; context resolution; member reads/writes/dispatch;
subclass defaults reaching the object and yielding to constructor arguments; and
per-frame animation dispatching nothing.

The build succeeds but its output is not consumable outside the monorepo - see
cost 2. **No pixels were rendered**: there is no `WebGLRenderer` here, so nothing
verifies that a scene draws correctly - only that the object graph and the values
on it are what they should be.
