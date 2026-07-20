# `map` - Reactive Maps

```ts
import State, { map, watch } from '@expressive/mvc';
```

Creates a reactive `Map`. Reads register subscriptions in active `watch()` / `State.get()` effects, and writes notify only the changed key plus collection shape when entries are added or removed.

`map()` is a field instruction like `set()`, `get()`, `ref()`, and `def()`: it resolves during activation of the hosting state, which adopts the map in the same step. It is not usable standalone - the map only exists once a State field resolves it.

The argument selects one of three modes, each with exactly one insertion verb:

| call | interface | insert | identity |
| --- | --- | --- | --- |
| `map<K, V>()` / `map(entries)` | `map.Keyed<K, V>` | `set(key, value)` | your keys |
| `map(StateClass)` / `map(() => V)` | `map.Pool<V, A>` | `add(...args)` | the value itself |
| `map((key: K, ...rest: A) => V)` | `map.Create<A, V>` | `set(key, ...rest)` spawns | your keys |

`add` returns the value it spawned - the call site holds the reference, so the value is its own identity. `set` returns the map - the key is the only retrieval handle, so entries are keyed. A factory that *requires* its first parameter is keyed by it; a class or parameterless factory spawns anonymous members into a pool.

## Keyed

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

## Pool

A `State` class or parameterless factory makes a pool: an owned collection of anonymous values. `add(...args)` spawns through it and returns the value - which is also its identity, so `has`, `delete`, and eviction all take the value itself. Pools have no keys: no `set`, `get(key)`, `entries`, or `keys`; iteration yields values directly.

```ts
class Field extends State {
  sparks = map(() => new Spark());

  ignite() {
    return this.sparks.add();
  }
}
```

With a class, `add` forwards its arguments to the constructor - assign objects and init callbacks alike, exactly as `Type.new()` accepts them. A `Component` may receive its identity `key` this way, before the `new()` lifecycle hook runs:

```ts
class Player extends Component {
  stats = null;

  protected new() {
    this.stats = fetchStats(this.key);
  }
}

class Roster extends State {
  players = map(Player);

  join(id: string) {
    return this.players.add({ key: id }); // new Player, stats loading
  }
}
```

A pool of `Component` values renders directly - `<>{[...roster.players.values()]}</>` - each instance carrying its own identity.

Note: a factory with an *optional* first parameter (`(key = 'x') => ...`) has arity 0 and is a pool. A keyed factory must require its key; for a keyed slot with no meaningful key, type it `null` and call `set(null)`.

## Create

A factory that requires its first parameter makes a keyed spawning map. `set(key, ...rest)` invokes the factory with exactly those arguments and stores the result at `key`; setting an occupied key replaces (destroying the previous value if owned). There is no `add`, and no direct insertion - every entry passes through the factory.

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

Spawning maps own what they spawn: when a spawned `State` value is deleted, cleared, or replaced, the map destroys it. This includes activated values the factory *made* (`() => Item.new()`); a value the factory merely passed through from its arguments is not spawned. In a plain keyed map, ownership follows freshness - a never-activated value stored via `set` is adopted and owned, while an already-activated one is a guest and never destroyed. Non-State spawned values are simply dropped.

Every map is adopted by its hosting state when that state activates - the field instruction resolves and adopts in one step, so a usable map always has an owner. The field itself is read-only; assigning over it throws. Fresh (never-activated) `State` values landing in the map - spawned, stored via `set`, or already present at activation - are parented to the owner and activate inside its context: `get(Owner)` resolves directly and providers above the owner resolve from members. Owned members are destroyed with the owner. An already-activated value cannot be adopted - its parent is settled - so it keeps guest status.

Death also flows the other way: a `State` value that dies evicts itself from the map - owned or guest, keyed or pooled - so a map never serves destroyed entries. Destroying a member (`member.set(null)`) is therefore a complete removal gesture on its own.

```ts
class Member extends State {
  owner = get(Owner);
}

class Owner extends State {
  members = map(Member);
}

const owner = Owner.new();
const member = owner.members.add(); // member.owner === owner

owner.set(null);                    // member destroyed with owner
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

Calling `get()` with no key returns a shallow snapshot - a `ReadonlyMap` for keyed maps, a `ReadonlySet` for pools. Nested values with a `.get()` method are exported through that method, matching State snapshots.

```ts
class Store extends State {
  products = map([['a', Product.new()]]);
}

const snapshot = Store.new().products.get();

snapshot.get('a'); // exported product values
```

## Type Signature

```ts
function map<K, V>(entries?: Iterable<readonly [K, V]> | null): map.Keyed<K, V>;
function map<T extends State>(Type: new (...args: State.Args<T>) => T): map.Pool<T, State.Args<T>>;
function map<V>(make: () => V): map.Pool<V>;
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

interface SetLike<V> {
  readonly size: number;
  get(): ReadonlySet<State.Export<V>>;
  has(value: V): boolean;
  delete(value: V): boolean;
  clear(): void;
  values(): MapIterator<V>;
  values<R>(fn: (value: V) => R): Iterable<R>;
  [Symbol.iterator](): MapIterator<V>;
}

interface map.Keyed<K, V> extends MapLike<K, V> {
  set(key: K, value: V): this;
}

interface map.Create<A extends [unknown, ...unknown[]], V> extends MapLike<A[0], V> {
  set(...args: A): this; // the factory's own signature; A[0] is the key
}

interface map.Pool<V, A extends unknown[] = []> extends SetLike<V> {
  add(...args: A): V;
}
```

## Behavior

- Any native `Map` key type is supported, including object and `undefined` keys.
- `get(key)` and `has(key)` track that key only; in a pool, `has(value)` tracks that value.
- Insertion notifies the key; a new key also notifies collection shape.
- Setting an existing key to the same value does not notify.
- `delete(key)` and `clear()` notify removed keys and collection shape.
- `keys()` tracks shape only; changing an existing value does not notify key iteration.
- `values()`, `entries()`, `forEach()`, and `for...of` track shape and each visited value.
- `keys(fn)`, `values(fn)`, and `entries(fn)` return reusable iterables of transformed results - fresh pass per iteration, same tracking as their plain forms. `throw false` in the callback skips the entry.
- `add` fires the same events as `set` and exists only on pools; calling it elsewhere throws, as does `set` on a pool.
- Mode selection is by argument: iterable/none is keyed, class or arity-0 function is a pool, a function requiring its first parameter is a keyed spawner.
- Reactivity is shallow. Nested State, `hot()`, and `map()` values keep their own reactivity when accessed through the map.
