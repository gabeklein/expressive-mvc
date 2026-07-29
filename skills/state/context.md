# Context - State Discovery & Ownership

Hierarchical registry that lets State instances find each other. Every active State has a **home context** that determines where its `state.get(Type)` lookups originate.

## Home Context

A State's home is assigned at activation and is permanent. It's recorded in a single internal `LOOKUP` map keyed by the state instance.

| Activation path                              | Home becomes     |
| -------------------------------------------- | ---------------- |
| `State.new()`                                | `Context.root`   |
| `new Context(StateClass)`                    | That context     |
| `new State()` then `new Context(instance)`   | That context     |
| `Provider for={StateClass}` (React)          | Provider context |

> First-wins: once a state has a home, no later context can transfer ownership.

> A bare `State.new()` resolves its `get()` lookups against root either way, but it only *registers* into root - becoming findable by others - when the class opts in with `static global`. See [Root Context](#root-context).

### Construct vs Activate

The escape hatch for "create now, place in context later" is the difference between `new State()` and `State.new()`:

```ts
// .new() activates immediately - home resolves to root, locked
const a = MyState.new(); // post init
new Context(a); // does NOT change a's home

// new MyState() constructs without firing the activation event
// - first explicit Context wraps it before init runs
const b = new MyState();
new Context(b); // b's home is this context
```

This matters in tests and in code that prepares a state before placing it in a context tree.

### Child Inheritance

State-typed fields are added to their parent's home context at activation - children don't independently route to root, they follow the parent:

```ts
class Parent extends State {
  child = new Child();
}

const ctx = new Context(Parent);
ctx.get(Child); // child instance - registered in ctx, not root
```

Recursive: grandchildren inherit through their immediate parent. Reassigning a child field destroys the old child (if owned via `new Child()` syntax) and adds the replacement to the same context. Externally-assigned children are not destroyed on replacement.

## Root Context

`Context.root` is the process-global registry, and `Context.get(state)` falls back to it when a state has no recorded home. A State *reads* from root either way, but it only *registers* into root - becoming findable by others via `get(Type)` - when it opts in with `static global`.

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

`static global` is `readonly` and typed `State.Global` - a boolean, or a resolver `(self) => boolean` evaluated at activation (after props apply) to decide per instance or environment.

| Declaration                                       | Meaning                                                        |
| ------------------------------------------------- | -------------------------------------------------------------- |
| *(none)*                                          | private - reads globals, isn't one                             |
| `static readonly global = true`                   | global, **sealed** - subclasses inherit the type, can't opt out|
| `static readonly global = false`                  | not global, a **lockout** - subclasses can't opt in            |
| `static readonly global: State.Global = true`     | global, but subclasses may re-declare or opt out               |
| `static readonly global: State.Global = self => …`| conditional - e.g. `() => typeof window !== 'undefined'`        |

Two rules keep a global deliberate:

- **Re-declare on extend (runtime).** A subclass that would be global purely by inheriting a `true` throws on activation; it must re-declare (`true` to keep it, `false` to opt out). Checked only where the instance would actually register at root - a `<Provider>`-scoped one never trips it.
- **Lockout (compile-time).** A bare-literal `false` makes TypeScript reject a subclass `= true` (`TS2417`). Best-effort: a subclass escapes with a resolver (`static global = (() => true) as any`) or a wide cast - the sanctioned "I'm overriding the vendor" move. A plain `any`-cast boolean cannot.

Global status is irrelevant to a context-claimed State: an instance provided by a `<Provider>` (or any explicit context) never consults `global`.

### Global Collision

Two global instances of the same type in root mutually evict at the contested ancestor:

```ts
const a = Sub.new(); // Sub declares `static global`
const b = Sub.new();
Context.root.get(Sub, false); // undefined - both evicted
```

Read this as "a collision is opt-out from global" - if you create two, neither is the global instance. A third `Sub.new()` would re-claim global status (the empty contested set is reclaimable).

### Subtype Preservation

Eviction is per-ancestor. Sibling subtypes only collide at their shared supertype - subtype lookups remain unambiguous:

```ts
// Base is a widened global; each subtype re-declares (required on extend)
class SubA extends Base { static readonly global = true; }
class SubB extends Base { static readonly global = true; }

const a = SubA.new();
const b = SubB.new();

Context.root.get(Base, false); // undefined - contested at Base
Context.root.get(SubA);        // a - unambiguous at SubA
Context.root.get(SubB);        // b - unambiguous at SubB
```

### Explicit Bypass

Explicit registration (`new Context(state)`, `ctx.add(state, true)`, JSX `Provider`) bypasses global eviction. Global and explicit entries coexist; explicit wins priority on lookup.

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

`get(Type)` walks parents toward root. `get(Type, callback, true)` watches descendants (downstream).

### Ambiguity at Non-Root

Non-root contexts use different collision semantics: when two implicit children share an ancestor, both stay registered and `ctx.get(SharedAncestor)` returns `null` (ambiguous). Removing one heals the ambiguity:

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

This differs from root's permanent eviction because scoped contexts model "candidates available here," whereas root models "the global instance."

## API Surface

```ts
new Context();                         // empty
new Context(parentContext);            // child of parent
new Context(StateClass);               // create + register a state
new Context(stateInstance);            // register existing instance
new Context({ a: A, b: B });           // multi-state

ctx.get(Type);                         // upstream lookup, throws if missing
ctx.get(Type, false);                  // optional, returns undefined
ctx.get(Type, callback);               // upstream watch
ctx.get(Type, callback, true);         // downstream watch
ctx.add(state, explicit?);             // register a state
ctx.set(inputs, forEach?);             // register multiple
ctx.push(inputs?);                     // create child context
ctx.pop();                             // destroy this and descendants
Context.get(state);                    // static: state's home context
Context.root;                          // global registry
```

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).
