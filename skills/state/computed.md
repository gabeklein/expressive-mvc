# Computed Values - Reactive Getters

```ts
class Cart extends State {
  items: Item[] = [];

  get total() {
    return this.items.reduce((s, i) => s + i.price * i.qty, 0);
  }
}
```

A getter on a State subclass is auto-promoted to a memoized, dependency-tracked property.

## How It Works

At bootstrap State walks the prototype for class-syntax getters (`configurable: true`, no paired setter) and installs each on the instance as a managed property:

- First read runs the getter under a tracking proxy; managed reads through `this` subscribe.
- The result is cached; later reads skip the getter.
- A tracked dependency change marks it stale; the next read (or next flush) recomputes.
- A keyed event fires under the computed's own name when its value changes - subscribers can watch it without watching its inputs.

## Property Descriptor

| Trait        | Behavior                                            |
| ------------ | --------------------------------------------------- |
| Enumerable   | yes - in snapshots, `Object.keys()`, `ref(this)`    |
| Writable     | no - assignment throws `read-only`                  |
| Lazy         | first compute deferred until read or next flush     |
| Cached       | memoized, recomputed only when stale                |

## Tracking Rules

`this` inside the getter is a **tracking proxy** while it computes; reads through it subscribe. Opt out per read via `this.is` (the un-proxied instance):

```ts
get value() {
  const tracked = this.input;        // subscribes
  const ignored = this.is.timestamp; // silent
  return `${tracked} (${ignored})`;
}
```

## Inheritance

Getters compose like any class member - override or extend a parent's:

```ts
class Base extends State {
  count = 1;
  get total() {
    return this.count;
  }
}

class Extra extends Base {
  multiplier = 2;
  get total() {
    return super.total * this.multiplier;
  }
}
```

`super.total` runs under the same tracking proxy, so dependencies from both classes are picked up.

### Getter vs Field Across Classes

A getter overrides a base *getter*. Swapping kinds across the boundary is a TypeScript error - getter over base field `TS2611`, field over base getter `TS2610` - though the runtime resolves either (the getter wins and tracks). The errors are not suppressible on the subclass; the escape is on whichever side you control:

```ts
class Cart extends State {
  rate = 0.1;
  total = 0;
}

class TaxedCart extends Cart {
  // get total() {}                              // TS2611
  total = set((self: TaxedCart) => 100 * (1 + self.rate));
}
```

- **Own the subclass only:** override the field with a field. `set(self => ...)` is a computed in property position - legal TS and reactive.
- **Own the base:** put a member subclasses derive on the prototype - a getter, or a `get`/`set` accessor pair (writable, but a plain unmanaged accessor - see [When NOT a Computed](#when-not-a-computed)). A base `set(...)` field does not help: it is a property too, so a subclass getter still errors.

## Self-Reference

A computed can read its own previous value without looping:

```ts
class History extends State {
  input = '';
  previous: string | undefined;
  get tracked() {
    this.previous = this.tracked; // current value, before recompute
    return this.input.toUpperCase();
  }
}
```

First access sees `undefined`; later ones see the prior cached value.

## Order of Evaluation

Interdependent getters cascade in declaration order:

```ts
class Stats extends State {
  values: number[] = [];
  get count() { return this.values.length; }
  get sum() { return this.values.reduce((a, b) => a + b, 0); }
  get average() { return this.count === 0 ? 0 : this.sum / this.count; }
}
```

Reading `average` computes and caches `count` and `sum` first. When `values` changes, all three go stale and recompute in declaration order on next read.

## Suspense Cascading

A getter reading a pending `set()` property (placeholder, async factory) throws its suspense Promise; subscribers retry once upstream resolves:

```ts
class Profile extends State {
  userId = set<string>();
  user = set(async () => fetch(`/api/users/${this.userId}`).then((r) => r.json()));
  get displayName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
}
```

`displayName` suspends until `user` resolves, which suspends until `userId` is assigned. React's `<Suspense>` catches it as it would a direct read.

## Errors

- **Initial** compute: `console.warn` `An exception was thrown while initializing {state}.{key}.`, then rethrown to the caller.
- **Later** compute (after a dependency change): reported as `Caught.Getter` with the error as `cause` - unhandled, it escapes uncaught ([lifecycle.md](lifecycle.md#error-handling)). The value becomes `undefined`; the read does not throw.

## When to Promote a Derivation

A derived value earns a getter on shared state when it is read by **multiple consumers**, carries **domain or workflow meaning**, is **expensive** enough for memoized tracking, is a **deliberate part of the state's API**, or makes the state usefully **introspectable** (debugging, devtools). A calculation feeding one view - a formatted label, a step index, a `canSubmit` for one button - belongs in that component beside its dependency snapshot; promoting it widens the surface without adding meaning. Judge meaning, not reference counts - see [../react/refactor.md](../react/refactor.md) step 6.

## When NOT a Computed

A getter stays a plain JS accessor (not promoted) when:

- It has a paired setter: `get foo() {} set foo(v) {}`.
- It is defined via `Object.defineProperty(Class.prototype, 'foo', { get })` rather than class syntax (such descriptors default to `configurable: false`).
- It is on base `State` itself (`get` / `set` instance methods).

Paired get/set for native accessor semantics without memoization, `set()` for managed slots that take input, a getter for derived data.
