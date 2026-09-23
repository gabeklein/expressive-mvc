# Context - State Discovery & Ownership

Hierarchical registry through which State instances find each other. Every active State has a **home context** where its `state.get(Type)` lookups originate.

## Home Context

Recorded per instance (internal `LOOKUP` map); first explicit claim wins, and no later context can transfer it.

| Activation path                              | Home becomes     |
| -------------------------------------------- | ---------------- |
| `State.new()`                                | `Context.root`   |
| `new Context(StateClass)`                    | That context     |
| `new State()` then `new Context(instance)`   | That context     |
| `Provider for={StateClass}` (React)          | Provider context |

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

`Context.root` is the process-global registry; `Context.get(state)` falls back to it when a state has no recorded home. A State *reads* from root either way, but only *registers* - becoming findable via `get(Type)` - when it opts in with `static global`.

```ts
class Flags extends State {
  static readonly global = true;
}
Flags.new();
Context.root.get(Flags); // the instance

class Private extends State {}
Private.new();
Context.root.get(Private, false); // undefined - private, not a global
```

### Declaring a global

`static global` is `readonly`, typed `State.Global` - a boolean, or a resolver `(self) => boolean` evaluated at activation (after props apply) to decide per instance or environment.

| Declaration                                       | Meaning                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| *(none)*                                          | private - reads globals, isn't one                             |
| `static readonly global = true`                   | global, **sealed** - subclasses inherit the type, can't opt out|
| `static readonly global = false`                  | not global, a **lockout** - subclasses can't opt in            |
| `static readonly global: State.Global = true`     | global, but subclasses may re-declare or opt out               |
| `static readonly global: State.Global = self => …`| conditional - e.g. `() => typeof window !== 'undefined'`        |

Two rules keep a global deliberate:

- **Re-declare on extend (runtime).** A subclass that would be global purely by inheriting `true` throws on activation; it must re-declare (`true` to keep, `false` to opt out). Checked only where the instance would actually register at root - a `<Provider>`-scoped one never trips it.
- **Lockout (compile-time).** A bare-literal `false` makes TypeScript reject a subclass `= true` (`TS2417`). Best-effort: a subclass escapes with a resolver (`static global = (() => true) as any`) or a wide cast - the sanctioned "I'm overriding the vendor" move. A plain `any`-cast boolean cannot.

A context-claimed State never consults `global` - an instance provided by a `<Provider>` (or any explicit context) is unaffected by it.

> **Server render:** root is process-global, so a declared global is *shared across requests* on the server (it is not sealed). Keep per-request data in a `<Provider>`. See [Server render](../react/react.md#server-render-ssr--rsc).

### Global Collision

A global is a singleton - a second global instance of the same type throws on activation:

```ts
const a = Sub.new(); // Sub declares `static global`
Sub.new();           // throws - Sub already exists in root
Context.root.get(Sub); // a - first instance unaffected
```

Destroy the existing one first (`a.set(null)`) and a fresh `Sub.new()` registers cleanly. To hold several deliberately, register them explicitly ([Explicit Bypass](#explicit-bypass)).

### Subtype Eviction

Sibling subtypes are different types - they don't throw; they collide only at their shared supertype, where both evict. Subtype lookups stay unambiguous:

```ts
// Base is a widened global; each subtype re-declares (required on extend)
class SubA extends Base { static readonly global = true; }
class SubB extends Base { static readonly global = true; }

const a = SubA.new();
const b = SubB.new();

Context.root.get(Base, false); // undefined - contested at Base
Context.root.get(SubA);        // a
Context.root.get(SubB);        // b
```

### Explicit Bypass

Explicit registration (`new Context(state)`, `ctx.add(state, true)`, JSX `Provider`) bypasses collision handling - no throw, no eviction. Global and explicit entries coexist; explicit wins on lookup.

```ts
const a = Sub.new();          // global, in root
const b = new Sub();
Context.root.add(b, true);    // explicit, no eviction

Context.root.get(Sub); // b - explicit wins
```

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

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).
