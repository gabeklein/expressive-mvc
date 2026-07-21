# `map` - Reactive Maps

```ts
import State, { map, watch } from '@expressive/mvc';
```

Creates a reactive `Map`. Reads register subscriptions in active `watch()` / `State.get()` effects, and writes notify only the changed key plus collection shape when entries are added or removed.

`map()` is a field instruction like `set()`, `get()`, `ref()`, and `def()`: it resolves during activation of the hosting state, which adopts the map in the same step. It is not usable standalone - the map only exists once a State field resolves it.

The argument selects one of two modes:

| call | interface | insert |
| --- | --- | --- |
| `map<K, V>()` / `map(entries)` | `map.Insert<K, V>` | `set(key, value)` |
| `map((key: K, ...rest: A) => V)` | `map.Create<A, V>` | `set(key, ...rest)` spawns |

`set` returns the map - the key is the retrieval handle, so entries are keyed. A factory is keyed by its first parameter.

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

Iteration is reactive. `size`, `keys()`, `values()`, `entries()`, `forEach()`, and `for...of` subscribe to collection shape. Value iteration also subscribes to each value it reads.

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

A factory makes a keyed spawning map, keyed by its first parameter. `set(key, ...rest)` invokes the factory with exactly those arguments and stores the result at `key`; setting an occupied key replaces (destroying the previous value if owned). There is no direct insertion - every entry passes through the factory.

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

Guest entries are the factory's decision, not the map's: a factory that passes a supplied value through keeps it a guest.

```ts
class Basket extends State {
  items = map((id: string, item?: Item) => item || new Item());
}

basket.items.set('a');           // spawned - owned
basket.items.set('b', existing); // passed through - guest
```

## Ownership

Spawning maps own what they spawn: when a spawned `State` value is deleted, cleared, or replaced, the map destroys it. This includes activated values the factory *made* (`(key) => Item.new()`); a value the factory merely passed through from its arguments is not spawned. In a plain keyed map, ownership follows freshness - a never-activated value stored via `set` is adopted and owned, while an already-activated one is a guest and never destroyed. Non-State spawned values are simply dropped.

Every map is adopted by its hosting state when that state activates - the field instruction resolves and adopts in one step, so a usable map always has an owner. The field itself is read-only; assigning over it throws. Fresh (never-activated) `State` values landing in the map - spawned, stored via `set`, or already present at activation - are parented to the owner and activate inside its context: `get(Owner)` resolves directly and providers above the owner resolve from members. Owned members are destroyed with the owner. An already-activated value cannot be adopted - its parent is settled - so it keeps guest status.

Death also flows the other way: a `State` value that dies evicts itself from the map - owned or guest - so a map never serves destroyed entries. Destroying a member (`member.set(null)`) is therefore a complete removal gesture on its own.

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

Keys compare like native `Map` (SameValueZero). Any key type is supported, including objects and `undefined`.

## Transforms

`keys(fn)`, `values(fn)`, and `entries(fn)` return a **reusable iterable** of transformed results - each iteration starts fresh against the live map, so it never exhausts (a repeat consumer, like a renderer verifying keys, sees the full sequence again). Subscriptions match the plain iterators exactly: `values(fn)` and `entries(fn)` track shape plus each visited value; `keys(fn)` tracks shape only. Throw `false` inside the callback to skip an entry; real errors propagate.

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

Calling `get()` with no key returns a shallow `ReadonlyMap` snapshot. Nested values with a `.get()` method are exported through that method, matching State snapshots.

```ts
class Store extends State {
  products = map([['a', Product.new()]]);
}

const snapshot = Store.new().products.get();

snapshot.get('a'); // exported product values
```

## Type Signature

```ts
function map<K, V>(entries?: Iterable<readonly [K, V]> | null): map.Insert<K, V>;
function map<A extends [unknown, ...unknown[]], V>(make: (...args: A) => V): map.Create<A, V>;

// internal bases (not exported): reads, removal, iteration - no insertion verb
interface MapLike<K, V> {
  readonly size: number;
  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
  keys<R>(fn: (key: K) => R): Iterable<R>;
  values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  // plus plain entries/keys/values/forEach/[Symbol.iterator]
}

interface map.Create<A extends [unknown, ...unknown[]], V> extends MapLike<A[0], V> {
  set(...args: A): this; // the factory's own signature; A[0] is the key
}

// sugar for the plain keyed form - one interface backs both modes
type map.Insert<K, V> = map.Create<[key: K, value: V], V>;
```

At runtime both modes are one class, exposed as `map.Create` (a native `Map` subclass; a keyed map is a `map.Create` instance with the identity factory). Adapters may extend its prototype - this is the seam for rendering facades.

## Behavior

- Any native `Map` key type is supported, including object and `undefined` keys.
- `get(key)` and `has(key)` track that key only.
- Insertion notifies the key; a new key also notifies collection shape.
- Setting an existing key to the same value does not notify.
- `delete(key)` and `clear()` notify removed keys and collection shape.
- `keys()` tracks shape only; changing an existing value does not notify key iteration.
- `values()`, `entries()`, `forEach()`, and `for...of` track shape and each visited value.
- `keys(fn)`, `values(fn)`, and `entries(fn)` return reusable iterables of transformed results - fresh pass per iteration, same tracking as their plain forms. `throw false` in the callback skips the entry.
- Mode selection is by argument: iterable/none is keyed, a factory function is a keyed spawner.
- Reactivity is shallow. Nested State, `hot()`, and `map()` values keep their own reactivity when accessed through the map.
