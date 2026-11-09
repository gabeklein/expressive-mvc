# `ref` - Mutable References

Runnable source: [`ref`](https://expressive.dev/examples/instructions/ref) and [`ref-multiple`](https://expressive.dev/examples/instructions/ref-multiple) - complete programs, served as HTML.

```ts
import { ref } from '@expressive/mvc';
```

Holds a mutable value (like React's `useRef`). Writes join the instance event stream; the property stays non-enumerable.

## Overloads

### Basic Ref

```ts
class Panel extends Model {
  element = ref<HTMLDivElement>();
}

const state = Panel.new();

state.element.current; // HTMLDivElement | null
state.element.current = div; // set via .current
```

Returns a `ref.Object<T>` - both a callable function and an object with `.current`.

### Ref with Callback

```ts
class Panel extends Model {
  node = ref<HTMLElement>((el) => {
    console.log('element attached:', el);
    return (next) => console.log('replaced with:', next);
  });

  any = ref<HTMLElement | null>((el) => {
    console.log('value is:', el); // fires for null too
  }, false);
}
```

The callback fires when a value is set - skipping `null` unless `false` is passed second. A returned function runs when the value is overwritten, receiving the new value.

### Ref Proxy

```ts
class Form extends Model {
  name = '';
  email = '';
  refs = ref(this);
}

const form = Form.new();

form.refs.name; // ref.Object<string>
form.refs.name.current; // current value of form.name
form.refs.name.current = 'new'; // updates form.name
```

A ref object for every enumerable property, each with `.current` (get/set), `.get()` (value or subscribe), `.is` (parent instance), and `.key` (property name).

- Computed getters (`get foo() { ... }`) are included, read-only.
- `set(...)` properties are excluded (non-enumerable).
- Takes a Model instance (normally `this`); a plain object throws.

### Custom Ref Proxy

```ts
class Form extends Model {
  name = '';
  email = '';
  fields = ref(this, (key) => createInput(key));
}
```

The map function runs lazily on first access per key; its result is cached.

Per-overload contract and `ref.Object` members: JSDoc on hover, or `node_modules/@expressive/mvc/dist/field/ref.d.ts`.

## Behavior

- Ref values are exported by `state.get()` (snapshots).
- `.current` is imperative: reading it does **not** subscribe, even inside a render or effect. For a reactive read, subscribe with `field.get(callback)` or read the field through the instance's tracking proxy (`state.foo`).
- Writing `.current` dispatches an event for the property key.
- Callback cleanup resets nested effects (same capture semantics as `set` callbacks).
