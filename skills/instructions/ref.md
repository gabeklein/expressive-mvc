# `ref` - Mutable References

```ts
import { ref } from '@expressive/state';
```

Holds a mutable value (like React's `useRef`). Updates to ref values are part of the state event stream but do not make the property enumerable.

## Overloads

### Basic Ref

```ts
class MyState extends State {
  element = ref<HTMLDivElement>();
}

const { is: state } = MyState.use();

state.element.current;       // HTMLDivElement | null
state.element.current = div; // set via .current
```

Returns a `ref.Object<T>` - simultaneously a callable function and an object with `.current`.

### Ref with Callback

```ts
class MyState extends State {
  node = ref<HTMLElement>((el) => {
    console.log('element attached:', el);
    return (next) => console.log('replaced with:', next);
  });
}
```

Callback fires when value is set (not on null by default). Return function is called when value is overwritten, receiving the new value.

### Ref with Callback (include null)

```ts
class MyState extends State {
  node = ref<HTMLElement | null>((el) => {
    console.log('value is:', el); // fires for null too
  }, false);
}
```

Pass `false` as second argument to also fire callback when set to `null`.

### Ref Proxy

```ts
class Form extends State {
  name = '';
  email = '';
  refs = ref(this);
}

const { is: form } = Form.use();

form.refs.name;          // ref.Object<string>
form.refs.name.current;  // current value of form.name
form.refs.name.current = 'new'; // updates form.name
form.refs.email;         // ref.Object<string>
```

Creates ref objects for every enumerable property on the state. Each ref has `.current` (get/set), `.get()` (value or subscribe), `.is` (parent state), and `.key` (property name).

- Reactive computed properties (`set((from) => ...)`) are included but read-only.
- Factory-based properties (`set(() => ...)`) are excluded (non-enumerable).
- Must pass `this` - any other object throws.

### Custom Ref Proxy

```ts
class Form extends State {
  name = '';
  email = '';
  fields = ref(this, (key) => createInput(key));
}
```

Map function runs lazily on first access per key. Return value is cached.

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
- Ref values are accessible through tracking proxies in effects.
- Setting `.current` dispatches an event for the property key.
- Callback cleanup resets nested effects (same capture semantics as `set` callbacks).
- `null` callback is skipped by default; pass `false` as second arg to include it.
