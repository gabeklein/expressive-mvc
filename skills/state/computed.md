# Computed Values - Reactive Getters

```ts
class Cart extends State {
  items: Item[] = [];

  get total() {
    return this.items.reduce((s, i) => s + i.price * i.qty, 0);
  }
}
```

A getter declared on a State subclass is auto-promoted to a memoized, dependency-tracked property.

## How It Works

When State bootstraps a class, it walks the prototype and finds every class-syntax getter (must have `configurable: true` and no paired setter). Each one is installed on the instance as a managed property:

- The first read invokes the getter under a tracking proxy. Any managed property read through `this` registers a subscription.
- The result is cached. Subsequent reads return the cached value without re-running.
- When a tracked dependency changes, the cached value is marked stale. The next read (or the next flush) recomputes.
- A keyed update event fires for the computed's own name when the value changes - subscribers can watch the computed directly without watching its inputs.

## Property Descriptor

| Trait        | Behavior                                            |
| ------------ | --------------------------------------------------- |
| Enumerable   | yes - included in snapshots, `Object.keys()`, `ref(this)` |
| Writable     | no - assignment throws `read-only`                  |
| Lazy         | first compute deferred until read or next flush     |
| Cached       | result memoized, recomputed only when stale         |

## Tracking Rules

`this` inside the getter is a **tracking proxy** when the compute runs. Reads through it subscribe.

```ts
class Doubled extends State {
  value = 10;
  get doubled() {
    return this.value * 2; // subscribes to `value`
  }
}
```

To opt out of tracking for a single read, go through `this.is`:

```ts
get value() {
  const tracked = this.input;       // subscribes
  const ignored = this.is.timestamp; // silent - does not subscribe
  return `${tracked} (${ignored})`;
}
```

`this.is` returns the un-proxied instance, so reads bypass the tracking machinery.

## Inheritance

Getters compose like any class member:

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

Subclasses can override or extend a parent's getter. `super.total` invokes the parent's getter under the same tracking proxy, so dependencies on both classes are picked up.

## Self-Reference

A computed can read its own previous value without infinite looping:

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

The first access returns `undefined` for `this.tracked` (no value yet). Subsequent accesses see the prior cached value.

## Order of Evaluation

When several computed getters depend on each other, evaluation cascades in declaration order:

```ts
class Stats extends State {
  values: number[] = [];
  get count() { return this.values.length; }
  get sum() { return this.values.reduce((a, b) => a + b, 0); }
  get average() { return this.count === 0 ? 0 : this.sum / this.count; }
}
```

Reading `state.average` triggers `count` and `sum` first; they cache, then `average` computes. On `values` change, all three become stale and recompute in declaration order on next read.

## Suspense Cascading

A getter that reads a pending `set()` property (placeholder, async factory) will throw the suspense Promise. Subscribers retry once the upstream resolves:

```ts
class Profile extends State {
  userId = set<string>();
  user = set(async () => fetch(`/api/users/${this.userId}`).then((r) => r.json()));
  get displayName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
}
```

`displayName` suspends until `user` resolves, which suspends until `userId` is assigned. React's `<Suspense>` boundary catches it, the same way a direct read would.

## Errors

Errors inside a getter are warned and rethrown:

- On the **initial** compute, the error is logged via `console.warn` with `An exception was thrown while initializing {state}.{key}.` and rethrown to the caller.
- On a **subsequent** compute (after a dependency change), the error is logged via both `console.warn` (refreshing) and `console.error`. The cached value is not updated, but the read does not throw.

## When NOT a Computed

A class-syntax getter is left as a plain JS accessor (not promoted) when:

- It has a paired setter: `get foo() {} set foo(v) {}`.
- It is defined via `Object.defineProperty(Class.prototype, 'foo', { get })` rather than class syntax (descriptors created this way default to `configurable: false`).
- It is on the base `State` class itself (framework hooks like `get` and `set` instance methods).

Use a paired get/set for native JS accessor semantics with no reactivity. Use `set()` for managed slots that take input. Use a getter for derived data.
