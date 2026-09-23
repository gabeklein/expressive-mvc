# `map` - Reactive Maps

Runnable source: [`map`](https://expressive.dev/examples/instructions/map) and [`map-insert`](https://expressive.dev/examples/instructions/map-insert) - complete programs, served as HTML.

```ts
import State, { map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

A reactive `Map`. Reads subscribe in active `watch()` / `State.get()` effects; writes notify only the changed key, plus collection shape when entries are added or removed.

A field instruction like `set()`, `get()`, `ref()`, and `def()`: it resolves during activation of the hosting state, which adopts the map in the same step. Not usable standalone.

The argument selects the mode:

| call | interface | insert |
| --- | --- | --- |
| `map<K, V>()` / `map(entries)` | `map.Insert<K, V>` | `set(key, value)` |
| `map((key: K, ...rest: A) => V)` | `map.Create<A, V>` | `set(key, ...rest)` spawns |

`set` returns the map - the key is the retrieval handle. A factory is keyed by its first parameter.

## Insert

```ts
class Store extends State {
  products = map<string, Product>();

  add(product: Product) {
    this.products.set(product.id, product);
  }
}

const store = Store.new();

store.get(($) => {
  console.log($.products.get('sku_123'));
});

store.products.set('sku_123', product); // reruns the effect
store.products.set('sku_456', product); // does not rerun an effect that only read sku_123
```

Iteration is reactive: `size`, `keys()`, `values()`, `entries()`, `forEach()`, and `for...of` subscribe to shape; value iteration also subscribes to each value it reads.

```ts
class Store extends State {
  products = map([
    ['a', { name: 'Hat' }],
    ['b', { name: 'Socks' }]
  ]);
}

const { products } = Store.new();

watch(products, ($) => {
  for (const product of $.values()) console.log(product.name);
});

products.set('b', { name: 'Shoes' }); // reruns the effect
products.set('c', { name: 'Bag' }); // reruns because shape changed
```

## Create

`set(key, ...rest)` invokes the factory with exactly those arguments and stores the result at `key`; an occupied key is replaced (the previous value destroyed if owned). No direct insertion - every entry passes through the factory.

```ts
class Cart extends State {
  items = map((id: string) => new Line(id));
}

const cart = Cart.new();

cart.items.set('sku_123');            // spawns Line at that key
cart.items.get('sku_123')!.qty = 2;   // per-item updates live on the value

cart.items.set('sku_123');            // respawns, destroying previous Line
```

Extra `set` arguments flow through after the key:

```ts
class Board extends State {
  cells = map((at: string, color: string) => new Cell(at, color));
}

board.cells.set('a1', 'black');
```

A value the factory constructs fresh is owned; an already-activated value it returns is a guest:

```ts
class Basket extends State {
  items = map((id: string, item?: Item) => item || new Item());
}

basket.items.set('a');               // new Item() - owned
basket.items.set('b', Item.new());   // already activated - guest
```

## Ownership

Ownership follows freshness, in both modes and however a value arrives. A fresh (never-activated) `State` - a `new Item()` handed to `set`, constructed by a factory, or in initial entries - is adopted and owned; the map destroys it when its entry is deleted, cleared, or replaced. An already-activated value (`Item.new()`) is a guest - its parent is settled, so it is held but never destroyed. Non-State values are never owned.

The hosting state adopts every map at activation, so a usable map always has an owner. The field is read-only - assigning over it throws. Fresh `State` values are parented to the owner and activate inside its context: `get(Owner)` resolves directly, and providers above the owner resolve from members. Owned members die with the owner.

Destruction is an eviction concern, separate from context: `delete` destroys the owned entry it removes, `clear` does so for every entry, and the owner dying is a `clear`. So `map.Managed` can be constructed without an owner (`new map.Managed()`, chiefly for testing) - no context to parent fresh values into, but it still owns and destroys them on eviction; guests behave as usual.

A `State` value that dies evicts itself - owned or guest - so a map never serves destroyed entries, and `member.set(null)` is a complete removal on its own.

```ts
class Member extends State {
  owner = get(Owner);
}

class Owner extends State {
  members = map((key: string) => new Member());
}

const owner = Owner.new();
const member = owner.members.set('a').get('a')!; // member.owner === owner

owner.set(null);                                 // member destroyed with owner
```

## Transforms

`keys(fn)`, `values(fn)`, and `entries(fn)` return a **reusable iterable** of transformed results - each iteration is a fresh pass over the live map, so it never exhausts (a repeat consumer, like a renderer verifying keys, sees the full sequence again). Tracking matches the plain iterators. Throw `false` in the callback to skip an entry; real errors propagate.

```ts
class Cart extends State {
  items = map((id: string) => new Line(id));

  get subtotals() {
    return [...this.items.values((line) => line.price * line.qty)];
  }
}

const rows = cart.items.values((line, id) => `${id}: ${line.qty}`);

[...rows]; // fresh pass over current entries
[...rows]; // again - not exhausted
```

## Snapshots

`get()` with no key returns a shallow `ReadonlyMap` snapshot; nested values with a `.get()` method export through it, matching State snapshots.

```ts
class Store extends State {
  products = map([['a', Product.new()]]);
}

const snapshot = Store.new().products.get();

snapshot.get('a'); // exported product values
```

## Type Signature

```ts
function map<K, V>(entries?: Iterable<readonly [K, V]> | false | null): map.Insert<K, V>;
function map<A extends [unknown, ...unknown[]], V>(make: (...args: A) => V): map.Create<A, V>;

// runtime base, reachable as map.Managed: reactive native Map subclass.
// Declares reads, removal, and iteration; the public shapes below narrow set.
declare class Managed<K, V> extends Map<K, V> {
  readonly size: number;
  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  set(key: K, ...rest: unknown[]): this;
  entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
  keys<R>(fn: (key: K) => R): Iterable<R>;
  values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  // plus plain entries/keys/values/forEach/[Symbol.iterator]
}

// both public shapes extend the class, each narrowing set to its mode
interface map.Create<A extends [unknown, ...unknown[]], V> extends Managed<A[0], V> {
  set(...args: A): this; // the factory's own signature; A[0] is the key
}

interface map.Insert<K, V> extends Managed<K, V> {
  set(key: K, value: V): this;
}

// the class itself is surfaced as map.Managed (value + type)
export { Managed };
```

At runtime both modes are one class, `map.Managed` (a native `Map` subclass; a keyed map uses the identity factory) - the seam adapters extend for rendering facades.

In `@expressive/react` a map renders directly - `<ul>{this.items}</ul>` - through a `$$typeof` facade on that prototype: one element whose values render in order (each carrying its own identity), subscribing to shape without a manual spread. `Component` values render themselves; others render as their React child form.

## Behavior

- Keys compare like native `Map` (SameValueZero); any key type works, including objects and `undefined`.
- `get(key)` and `has(key)` track that key only.
- Insertion notifies the key; a new key also notifies shape. Setting a key to its current value does not notify.
- `delete(key)` and `clear()` notify removed keys and shape.
- `keys()` tracks shape only - changing an existing value does not notify key iteration.
- `values()`, `entries()`, `forEach()`, and `for...of` track shape and each visited value; the `fn` transforms track the same as their plain forms.
- Reactivity is shallow. Nested State, `map()`, and `has()` values keep their own reactivity when accessed through the map.
