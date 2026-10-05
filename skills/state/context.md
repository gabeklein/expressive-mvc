# Context - State Discovery & Ownership

Hierarchical registry through which State instances find each other. Every active State has a **home context** where its `state.get(Type)` lookups originate.

## Home Context

Recorded per instance (internal `LOOKUP` map); first explicit claim wins, and no later context can transfer it.

| Activation path                              | Home becomes     |
| -------------------------------------------- | ---------------- |
| `State.new()`                                | `Context.root`   |
| `new Context(StateClass)`                    | That context     |
| `new State()` then `new Context(instance)`   | That context     |
| `<Component for={StateClass}>`               | Component context |

> A bare `State.new()` resolves its `get()` lookups against root either way, but only *registers* into root - becoming findable by others - when the class opts in with `static global`. Registering is what locks a global's home to root; a private instance only falls back to root, so the first explicit context to claim it later still becomes its home. See [Root Context](#root-context).

### Construct vs Activate

To choose a home other than root, construct with `new State()` and place it in the same tick:

```ts
// .new() activates immediately - a global registers to root, home locked
const a = MyGlobal.new();
new Context(a); // does NOT change a's home

// new MyState() constructs without activating
// - the first explicit Context claims it before init runs
const b = new MyState();
new Context(b); // b's home is this context
```

Matters in tests and in code that prepares a state before placing it in a context tree. Placement is an ordering constraint, not a deferral - an instance not activated by the end of the tick warns. Release one you no longer want with `set(null)`.

### Child Inheritance

State-typed fields join their parent's home context at activation - children follow the parent, not root:

```ts
class Parent extends State {
  child = new Child();
}

const ctx = new Context(Parent);
ctx.get(Child); // child instance - registered in ctx, not root
```

- Recursive: grandchildren inherit through their immediate parent.
- Siblings resolve each other through their parent regardless of field order, so two parents never cross-resolve.
- Reassigning a child field destroys the old child if owned (`new Child()` syntax) and adds the replacement to the same context; externally-assigned children survive replacement.

## Root Context

`Context.root` is the process-global registry; `Context.get(state)` falls back to it when a state has no recorded home. A State *reads* from root either way, but only *registers* - becoming findable via `get(Type)` - when created with `State.use()` outside a render.

```ts
class Flags extends State {}
const flags = Flags.use(); // entry point - owned by root
Flags.get();               // flags, from anywhere

class Private extends State {}
Private.new();
Context.root.get(Private, false); // undefined - private
```

Call `use()` deliberately - an entry point, a request boundary - never from a helper that may also run in a render, where it creates a component-owned instance instead.

### Ambient context

`Context.get()` with no argument is the ambient context - root, unless a host overrides it (e.g. per request via `AsyncLocalStorage`). Client adapters do not override it; render position stays inside their `State.get()` and `State.use()`. An override replaces only the no-argument form - core resolves a State's own context without consulting it. It runs from every State constructor - keep it cheap, no hooks.

- `State.use()` outside a render creates in the ambient context, owned by it - destroyed when it pops.
- A State constructed while the ambient context is not root records it as its home fallback: `get(Type)` fields and `state.get(Type)` resolve from it. Registering into a context still wins.
- A child held by an anchored, context-less parent inherits the parent's anchor.
- Don't keep a static `get()` result on a longer-lived object - it stays tied to the context it came from.

### Shadowing

`use()` - in a render or out - throws if `get()` would already resolve the type where it runs (a second `use()`, an upstream provider or `use()`, a subclass instance, an explicit entry), or if it would hide an instance of exactly one of its supertypes - `Sub.use()` beside a `Base` instance.

```ts
Flags.use();
Flags.use(); // throws - Flags is already in context
```

To hold another deliberately, scope it: nest `<Component for={Flags}>`, or register explicitly (`new Context(state)`, `ctx.add(state, true)`).

### Subtype Eviction

Sibling subtypes are different types - they don't throw; in the context they are created in they collide only at their shared supertype, where both evict. Subtype lookups stay unambiguous:

```ts
class SubA extends Base {}
class SubB extends Base {}

const a = SubA.use();
const b = SubB.use();

Context.root.get(Base, false); // undefined - contested at Base
Context.root.get(SubA);        // a
Context.root.get(SubB);        // b
```

### Explicit Bypass

Explicit registration (`new Context(state)`, `ctx.add(state, true)`, `<Component for>`) bypasses eviction and wins on lookup. A later `use()` of that type throws.

### `static global` (deprecated)

`State.new()` on a class declaring `static readonly global = true` registers exactly like `use()` - arguments still go to the constructor. A resolver (`static global = self => …`) decides at activation. A subclass that would be global purely by inheriting `true` throws on activation; re-declare it. Prefer `use()` at the call site.

> **Server render:** root is process-global, so an instance `use()`d into root is *shared across requests*. Keep per-request data in a `<Component for>`, or `use()` it under a host's per-request context. See [Server render](../react/react.md#server-render-ssr--rsc).

## Hierarchical Contexts

```ts
import { Context } from '@expressive/mvc';

const ctx = new Context({ AppState, UserState });
const app = ctx.get(AppState);

const child = ctx.push({ ChildState });
child.pop(); // destroy child context
```

`get(Type)` walks parents toward root.

### Ambiguity at Non-Root

When two implicit children share an ancestor type, both stay registered and `ctx.get(SharedAncestor)` returns `null` (ambiguous). Removing one heals it:

```ts
class Parent extends State {
  foo: Foo | undefined = new Foo();
  bar = new Bar(); // Bar extends Foo
}

const ctx = new Context(Parent);
ctx.get(Foo); // null - ambiguous
ctx.get(Parent).foo = undefined;
ctx.get(Foo); // Bar instance - heals
```

Unlike root - where a same-type duplicate throws and ancestor contests evict permanently - scoped contexts model "candidates available here," root models "the global instance."

## Providing with Component

Bare `Component` (not a subclass) given `for` provides one State to its children, in any host:

```tsx
<Component for={Session} name="Ada" is={(session) => …}>…</Component>  // constructed, owned
<Component for={session} name="Ada">…</Component>                      // provided as-is
```

- A class is constructed, owned and destroyed with the element; `is` receives it; its `mount()` runs with the element's, and a replacement class takes over the mount.
- An active instance is provided, never destroyed; `is` is rejected. An unactivated one is adopted like a field - `for={new X()}` in render gives a State that lives for one render.
- Other attributes are typed from the provided State and assign to it on every render.
- Changing `for` releases the previous item, then provides the next.
- No suspense boundary unless `fallback` or `catch` is passed. Bare `<Component>` without `for` keeps `fallback = null`.
- One item only - several belong to a parent State that owns them as fields (`class Root extends State { theme = new Theme(); router = new BrowserRouter() }`), where they resolve each other as siblings with `get()`. Nesting `<Component for>` elements works but is a smell: the inner State can `get` the outer, not the reverse.

## Ownership vs Context

Context is where a State registers to be found; ownership is who constructed it. The two agree for a field child, and diverge whenever registration skips a level:

- A `has()` pool, `map()` entry or field child registers into the owner's *home* context, which may be several owners up - every State a root owns sits in the one context the root was provided into. Context cannot say which of them constructed which.
- Two siblings of one type are ambiguous to context (`get(Foo)` is `null`) but each has exactly one owner.
- A host-mounted Component, `use()` instance or `<Component for>` is owned by the Component rendering it, with no field between them.

`state.get(State)` reads the owner and `get(State, true)` lists what a State owns directly; neither consults context. Use a type to find a collaborator; use `State` to find structure - the thing that constructed you, or the things you will destroy. See [state.get()](get.md#owner).

```ts
class Node extends State {
  parent = get(State, false);   // whoever constructed this Node
  nodes = has(Node);            // owned - die with this Node
}

class Scene extends State {
  nodes = has(Node);
}

const scene = Scene.new();
const a = scene.nodes.add();
const b = a.nodes.add();

b.parent === a;                   // ownership, no type needed
a.parent === scene;
a.get(Scene) === scene;           // a type resolves its direct owner too
scene.get(State, (node) => attach(node), true); // direct members only - a, not b
```

## API Surface

```ts
new Context();                         // empty
new Context(parentContext);            // child of parent
new Context(StateClass);               // create + register a state
new Context(stateInstance);            // register existing instance
new Context({ a: A, b: B });           // multi-state

ctx.get(Type);                         // upstream lookup, throws if missing
ctx.get(Type, false);                  // optional, returns undefined
ctx.get(Type, callback);               // watch, upstream and downstream
ctx.get(Type, callback, true);         // downstream only
ctx.get(Type, callback, false);        // upstream only
ctx.add(state, explicit?);             // register a state
ctx.set(inputs, forEach?);             // register multiple
ctx.push(inputs?);                     // create child context
ctx.pop();                             // destroy this and descendants
Context.get(state);                    // static: state's home context
Context.root;                          // global registry
```

Primarily consumed via the [`get` instruction](../field/get.md) and [`<Component for>`](#providing-with-component).
