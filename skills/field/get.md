# `get` - Context Lookup Instruction

Runnable source: [`get`](https://expressive.dev/examples/instructions/get) (upstream) and [`get-downstream`](https://expressive.dev/examples/instructions/get-downstream) (collection) - complete programs, served as HTML.

```ts
import { get } from '@expressive/mvc';
```

Fetches another Model from the context hierarchy, upstream or downstream.

## Overloads

### Upstream

```ts
class Child extends Model {
  parent = get(ParentModel);          // nearest instance; throws if not found
  maybe = get(ParentModel, false);    // T | undefined; never throws
}
```

### Upstream with callback

```ts
class Child extends Model {
  parent = get(ParentModel, (parent, self) => {
    console.log('found:', parent);
    return () => console.log('detached');
  });
}
```

Receives `(state, subject)`. Runs when the upstream resolves, and again when it is replaced. A returned cleanup runs when the subject is destroyed.

### Downstream collection

```ts
class Parent extends Model {
  children = get(ChildModel, true);
  tracked = get(ChildModel, true, (child, self) => {
    console.log('registered:', child);
    return () => console.log('removed');
  });
}
```

`readonly T[]` of every instance of the type below in the context tree, updating as children are created and destroyed. The callback runs per child: return `false` to prevent registration, or a function for cleanup on removal.

### Downstream single

```ts
class Parent extends Model {
  child = get(ChildModel, true, true);   // throws if not found
  maybe = get(ChildModel, true, false);  // T | undefined
}
```

One downstream child; updates when a matching child appears or is removed.

### Owner

```ts
class Child extends Model {
  owner = get(Model);         // owning Model; throws if none
  maybe = get(Model, false);  // Model | undefined
}

class Parent extends Model {
  owned = get(Model, true);   // every Model this one owns
}
```

`Model` reads ownership instead of context - see [state.get()](../state/get.md#owner). Downstream forms collect the Models this one owns directly - not grandchildren, not context descendants; callbacks and the single forms work as for other types. The owner never changes after activation, so `get(Model)` is a stable reference, not a subscription.

## Type Signatures

```ts
function get<T extends Model>(Type: Model.Extends<T>, callback?: get.Callback<T>): T;
function get<T extends Model>(Type: Model.Extends<T>, required: false): T | undefined;
function get<T extends Model>(Type: Model.Extends<T>, downstream: true, callback?: get.Callback<T>): T[];
function get<T extends Model>(Type: Model.Extends<T>, downstream: true, single: true): T;
function get<T extends Model>(Type: Model.Extends<T>, downstream: true, required: false): T | undefined;

type get.Callback<T> = (state: T, subject: Model) => void | boolean | (() => void);
```

## Behavior

- All `get()` properties are **non-enumerable** (hidden from `Object.keys()`, spread, and `ref(this)`).
- Upstream walks ancestors by depth - each ancestor, then siblings under it, then the next ancestor up; the nearest match wins, an ancestor beats a sibling at its own level. The context hierarchy is the fallback.
- Siblings under one parent resolve regardless of field order - a required lookup waits for the activating ancestor to finish before throwing.
- Never resolves to itself.
- The upstream callback is not reactive - the upstream's own value changes do not re-run it.
- Downstream callbacks run cleanup before both target and recipient are destroyed.
- Downstream collection ignores redundant registrations of the same instance.
- Subclasses match (`get(Base, true)` collects `Base` and subclasses); superclasses do not (`get(Derived, true)` skips `Base` instances).
