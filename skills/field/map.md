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

interface State.Map<K, V> extends globalThis.Map<K, V> {
  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
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
- Reactivity is shallow. Nested State, `hot()`, and `map()` values keep their own reactivity when accessed through the map.
