# TypeScript — Expressive State

Type system overview for contributors and consumers.

## Key Type Aliases

Defined in `packages/state/src/state.ts` namespace `State`:

| Type | Purpose |
|------|---------|
| `State.Extends<T>` | Abstract or concrete constructor of T — use for parameters accepting a class |
| `State.Type<T>` | Concrete (instantiable) constructor — use when `new` is required |
| `State.Field<T>` | Keys of T excluding inherited State members |
| `State.Event<T>` | Valid event keys: `Field<T> \| number \| symbol \| (string & {})` |
| `State.Args<T>` | Constructor argument union: `(Args \| Init \| Assign \| string \| void)[]` |
| `State.Assign<T>` | Object form of constructor arg — maps properties preserving function `this` |
| `State.Values<T>` | All fields with ref objects unwrapped via `Export<R>` |
| `State.Export<R>` | If R has `.get()`, extracts return type; otherwise R |
| `State.Value<T, K>` | Single property value lookup with Export unwrapping |

## Generics Pattern

### Extends vs Type

```ts
// Accepts abstract classes too (for parameters, lookups)
function lookup<T extends State>(Type: State.Extends<T>): T | undefined;

// Requires concrete class (for instantiation)
function create<T extends State>(Type: State.Type<T>): T;
```

### Field excludes base members

```ts
class MyState extends State {
  foo = 1;       // included in Field<MyState>
  bar = 'hello'; // included
  // get(), set(), is, etc. — excluded
}
```

## Instruction Typing

Instruction type signatures are documented in their respective files under `instructions/`.

Instructions return symbols at definition time. The actual typed value is only available after initialization:

```ts
class Test extends State {
  value = set<string>(); // TypeScript sees string, runtime sees Symbol until init
}
```

## React Adapter Types

### Props inference

```ts
type Props<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};
```

Props are derived from State fields, all optional.

### Component props inference

Component classes derive JSX props from their state fields:

```ts
class MyComp extends Component {
  value = '';
  render() { return <div>{this.value}</div>; }
}

// All state fields are optional props
<MyComp value="hello" />
```

### State.use() argument inference

```ts
// If State defines use() method, its params become the hook args:
class Custom extends State {
  use(name: string, count: number) { ... }
}

Custom.use('hello', 42); // typed correctly

// Otherwise falls back to State.Args<T>
```

### State.get() factory types

```ts
// Factory receives proxy + refresh function
State.get((current, refresh) => {
  return current.foo + current.bar; // return type inferred
});

// NoVoid<T> converts undefined/void to null for React
State.get((current) => {
  if (!current.ready) return; // becomes null, not undefined
});
```

## Common Type Patterns

### string & {} trick

```ts
type Event<T> = Field<T> | number | symbol | (string & {});
```

Allows any string while preserving autocompletion for known keys.

### Tuple conditional for type guards

```ts
type PropsValid<P, T> = [PropsConflicting<P, Props<T>>] extends [never]
  ? unknown
  : never;
```

Wrapping in tuple prevents distribution over union.

### Recursive Args type

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | string | void)[];
```

Allows nested arrays in constructor arguments — they're flattened at runtime.

## tsconfig

- `strict: true` — full type checking
- `moduleResolution: "bundler"` — supports package.json exports
- `target: "es2020"` — WeakMap, Symbol, class features
- Path aliases: `@expressive/*` → `../*/src` for cross-package dev
