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

### Construct vs Activate

The escape hatch for "create now, place in context later" is the difference between `new State()` and `State.new()`:

```ts
// .new() activates immediately - home is root, locked
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

`Context.root` is a global singleton registry. Any state activated via `State.new()` outside an explicit context lands here.

```ts
const a = MyState.new();
Context.root.get(MyState); // a
```

`Context.root` is a regular `Context` instance (mutable static), and `Context.get(state)` falls back to it when a state has no recorded home.

### Singleton Collision

Two **implicit** instances of the same type in root mutually evict at the contested ancestor:

```ts
const a = Sub.new();
const b = Sub.new();
Context.root.get(Sub, false); // undefined - both evicted
```

Read this as "implicit collision is opt-out from singleton" - if you create two, neither is the singleton. A third `Sub.new()` would re-claim singleton status (the empty contested set is reclaimable).

### Subtype Preservation

Eviction is per-ancestor. Sibling subtypes only collide at their shared supertype - subtype lookups remain unambiguous:

```ts
class SubA extends Base {}
class SubB extends Base {}

const a = SubA.new();
const b = SubB.new();

Context.root.get(Base, false); // undefined - contested at Base
Context.root.get(SubA);        // a - unambiguous at SubA
Context.root.get(SubB);        // b - unambiguous at SubB
```

### Explicit Bypass

Explicit registration (`new Context(state)`, `ctx.add(state, true)`, JSX `Provider`) bypasses singleton eviction. Implicit and explicit entries coexist; explicit wins priority on lookup.

```ts
const a = Sub.new();          // implicit in root
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

This differs from root's permanent eviction because scoped contexts model "candidates available here," whereas root models "the global singleton."

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
Context.root;                          // global singleton registry
```

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).
