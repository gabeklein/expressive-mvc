# `map` - Reactive Maps

```ts
import State, { map, watch } from '@expressive/mvc';
```

Creates a reactive `Map`. Reads register subscriptions in active `watch()` / `State.get()` effects, and writes notify only the changed key plus collection shape when entries are added or removed.

`map()` is not a field instruction like `set()`, `get()`, `ref()`, or `def()`. It returns a reactive value that can be assigned directly to a State field or used outside State with `watch()`.

## Usage

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

## Iteration

Iteration is reactive. `size`, `keys()`, `values()`, `entries()`, `forEach()`, and `for...of` subscribe to collection shape. Value iteration also subscribes to each value it reads.

```ts
const products = map([
  ['a', { name: 'Hat' }],
  ['b', { name: 'Socks' }]
]);

watch(products, ($) => {
  for (const product of $.values()) console.log(product.name);
});

products.set('b', { name: 'Shoes' }); // reruns the effect
products.set('c', { name: 'Bag' }); // reruns because shape changed
```

## Factory

Pass a function to create a spawning map. Factory maps are keyed by string. `add(input?)` always passes `input` to the factory; `input` is also the key when it is a string. Any other input is factory-only - the key then derives from the value (`String(value)` - for a `State`, its natural id). `add` never replaces: an occupied key throws. `set(key)` with no value respawns through the factory, replacing the previous value (destroying it if owned).

```ts
class Cart extends State {
  items = map((id: string) => Line.new(id));
}

const cart = Cart.new();

const line = cart.items.add('sku_123'); // spawns Line
line.qty = 2;                           // per-item updates live on the value

cart.items.add('sku_123');              // throws - key occupied
cart.items.set('sku_123');              // respawns, destroying previous Line
```

Calling `add()` with no key lets the value key itself: the key becomes `String(value)` - for a `State`, its natural id.

```ts
class Field extends State {
  sparks = map(() => Spark.new());

  ignite() {
    return this.sparks.add(); // keyed by the spark's own id
  }
}
```

String keys carry identity - the occupied-key throw guards real duplication. Object inputs carry none (two objects with the same contents are distinct), so they never become keys; each such `add` creates a fresh, id-keyed entry. Derived keys must still be unique: plain values sharing a generic `String()` form (like `[object Object]`) collide on the second derive - give such values a `toString` or supply string keys. A spawned `State` orphaned by a derived-key collision is destroyed before the throw.

A `State` class may stand in for the factory. `add(input?)` instantiates it, forwarding `input` to the constructor. An object input is applied by the base constructor as an assign - fields merge natively - with the instance keyed by natural id. A string input keys the entry and reaches a constructor that declares it (the base constructor ignores strings).

```ts
class Roster extends State {
  players = map(Player);

  join(name: string) {
    return this.players.add({ name }); // new Player, fields assigned, keyed by id
  }
}
```

## Ownership

A factory map owns what it spawns. When a spawned `State` value is deleted, cleared, or replaced via `set`, the map destroys it. Values supplied directly through `set(key, value)` are guests - removal never destroys them. Non-State spawned values are simply dropped.

```ts
const items = map((id: string) => Item.new());

const item = items.add('a');
items.delete('a');       // item destroyed

const guest = Item.new();
items.set('b', guest);
items.delete('b');       // guest untouched
```

Keys compare like native `Map` (SameValueZero). Prefer primitive ids or stable object references as factory inputs - a fresh object literal is a new key every time.

## Snapshots

Calling `get()` with no key returns a shallow snapshot `ReadonlyMap`. Nested values with a `.get()` method are exported through that method, matching State snapshots.

```ts
const products = map([['a', Product.new()]]);
const snapshot = products.get();

snapshot.get('a'); // exported product values
```

## Type Signature

```ts
function map<K, V>(entries?: Iterable<readonly [K, V]> | null): State.Map<K, V>;
function map<T extends State>(Type: new (...args: any[]) => T): State.Map.Factory<T, string | State.Assign<T>>;
function map<V, I = string>(make: (input: I) => V, entries?: Iterable<readonly [string, V]> | null): State.Map.Factory<V, I>;

interface State.Map<K, V> extends globalThis.Map<K, V> {
  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
}

interface State.Map.Factory<V, I = string> extends State.Map<string, V> {
  add(input?: I): V;
  set(key: string): this;
  set(key: string, value: V): this;
}
```

## Behavior

- Any native `Map` key type is supported, including object and `undefined` keys.
- `get(key)` and `has(key)` track that key only.
- `set(key, value)` notifies the key; adding a new key also notifies collection shape.
- Setting an existing key to the same value does not notify.
- `delete(key)` and `clear()` notify removed keys and collection shape.
- `keys()` tracks shape only; changing an existing value does not notify key iteration.
- `values()`, `entries()`, `forEach()`, and `for...of` track shape and each visited value.
- `add` fires the same events as `set`.
- `add(input)` keys on `input` only when it is a string; otherwise the key derives from the value.
- `add` throws when the map was created without a factory, or when the key (given or derived) is already occupied.
- `set(key)` with no value respawns through the factory; it throws on a map without one.
- Reactivity is shallow. Nested State, `hot()`, and `map()` values keep their own reactivity when accessed through the map.
