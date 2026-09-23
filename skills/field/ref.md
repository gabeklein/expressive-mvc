# `ref` - Mutable References

Runnable source: [`ref`](https://expressive.dev/examples/instructions/ref) and [`ref-multiple`](https://expressive.dev/examples/instructions/ref-multiple) - complete programs, served as HTML.

```ts
import { ref } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Holds a mutable value (like React's `useRef`). Writes join the state event stream; the property stays non-enumerable.

## Overloads

### Basic Ref

```ts
class MyState extends State {
  element = ref<HTMLDivElement>();
}

const { is: state } = MyState.use();

state.element.current; // HTMLDivElement | null
state.element.current = div; // set via .current
```

Returns a `ref.Object<T>` - both a callable function and an object with `.current`.

### Ref with Callback

```ts
class MyState extends State {
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
class Form extends State {
  name = '';
  email = '';
  refs = ref(this);
}

const { is: form } = Form.use();

form.refs.name; // ref.Object<string>
form.refs.name.current; // current value of form.name
form.refs.name.current = 'new'; // updates form.name
```

A ref object for every enumerable property, each with `.current` (get/set), `.get()` (value or subscribe), `.is` (parent state), and `.key` (property name).

- Computed getters (`get foo() { ... }`) are included, read-only.
- `set(...)` properties are excluded (non-enumerable).
- Takes a State instance (normally `this`); a plain object throws.

### Custom Ref Proxy

```ts
class Form extends State {
  name = '';
  email = '';
  fields = ref(this, (key) => createInput(key));
}
```

The map function runs lazily on first access per key; its result is cached.

## `ref.Object<T>` Interface

```ts
interface ref.Object<T> {
  current: T;           // get/set the value
  is: State;            // parent state instance
  key: string;          // property name on state
  get(): T | null;      // retrieve current value
  get(cb: (v: T) => void): () => void; // subscribe to changes
}
```

## Type Signatures

```ts
function ref<T extends State>(state: T): ref.Proxy<T>;
function ref<T extends State, R>(state: T, map: (key: State.Field<T>) => R): ref.CustomProxy<T, R>;
function ref<T>(callback?: ref.Callback<T>): ref.Object<T>;
function ref<T>(callback: ref.Callback<T | null>, ignoreNull: boolean): ref.Object<T>;

type ref.Callback<T> = (argument: T) => ((next: T | null) => void) | Promise<void> | void | boolean;
type ref.Proxy<T> = { [P in State.Field<T>]-?: ref.Object<T[P]> } & { get(): T };
type ref.CustomProxy<T, R> = { [P in State.Field<T>]-?: R } & { get(): T };
```

## Behavior

- Ref values are exported by `state.get()` (snapshots).
- `.current` is imperative: reading it does **not** subscribe, even inside a render or effect. For a reactive read, subscribe with `field.get(callback)` or read the field through the state's tracking proxy (`state.foo`).
- Writing `.current` dispatches an event for the property key.
- Callback cleanup resets nested effects (same capture semantics as `set` callbacks).
