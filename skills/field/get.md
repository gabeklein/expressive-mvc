# `get` - Context Lookup Instruction

Runnable source: [`get`](https://expressive.dev/examples/instructions/get) (upstream) and [`get-downstream`](https://expressive.dev/examples/instructions/get-downstream) (collection) - complete programs, served as HTML.

```ts
import { get } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Fetches another State from the context hierarchy, upstream or downstream.

## Overloads

### Upstream

```ts
class Child extends State {
  parent = get(ParentState);          // nearest instance; throws if not found
  maybe = get(ParentState, false);    // T | undefined; never throws
}
```

### Upstream with callback

```ts
class Child extends State {
  parent = get(ParentState, (parent, self) => {
    console.log('found:', parent);
    return () => console.log('detached');
  });
}
```

Receives `(state, subject)`. Runs when the upstream resolves, and again when it is replaced. A returned cleanup runs when the subject is destroyed.

### Downstream collection

```ts
class Parent extends State {
  children = get(ChildState, true);
  tracked = get(ChildState, true, (child, self) => {
    console.log('registered:', child);
    return () => console.log('removed');
  });
}
```

`readonly T[]` of every instance of the type below in the context tree, updating as children are created and destroyed. The callback runs per child: return `false` to prevent registration, or a function for cleanup on removal.

### Downstream single

```ts
class Parent extends State {
  child = get(ChildState, true, true);   // throws if not found
  maybe = get(ChildState, true, false);  // T | undefined
}
```

One downstream child; updates when a matching child appears or is removed.

## Type Signatures

```ts
function get<T extends State>(Type: State.Extends<T>, callback?: get.Callback<T>): T;
function get<T extends State>(Type: State.Extends<T>, required: false): T | undefined;
function get<T extends State>(Type: State.Extends<T>, downstream: true, callback?: get.Callback<T>): T[];
function get<T extends State>(Type: State.Extends<T>, downstream: true, single: true): T;
function get<T extends State>(Type: State.Extends<T>, downstream: true, required: false): T | undefined;

type get.Callback<T> = (state: T, subject: State) => void | boolean | (() => void);
```

## Behavior

- All `get()` properties are **non-enumerable** (hidden from `Object.keys()`, spread, and `ref(this)`).
- Upstream checks the direct parent first, then siblings under each ancestor (nearest wins), then the context hierarchy.
- Siblings under one parent resolve regardless of field order - a required lookup waits for the activating ancestor to finish before throwing.
- Never resolves to itself.
- The upstream callback is not reactive - the upstream's own value changes do not re-run it.
- Downstream callbacks run cleanup before both target and recipient are destroyed.
- Downstream collection ignores redundant registrations of the same instance.
- Subclasses match (`get(Base, true)` collects `Base` and subclasses); superclasses do not (`get(Derived, true)` skips `Base` instances).
