# State - Type Aliases

Namespace types on `State` used throughout the API.

## Core Types

| Type                | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `State.Extends<T>`  | Abstract or concrete constructor - for parameters accepting a class     |
| `State.Type<T>`     | Concrete (instantiable) constructor - when `new` is required            |
| `State.Field<T>`    | Keys of T excluding inherited State members                             |
| `State.Event<T>`    | Valid event keys: `Field<T> \| number \| symbol \| (string & {})`       |
| `State.Args<T>`     | Constructor argument union: `(Args \| Init \| Assign \| void)[]`        |
| `State.Assign<T>`   | Object overlay - maps properties preserving function `this`             |
| `State.Values<T>`   | All fields with child states and ref objects unwrapped via `Export<R>`  |
| `State.Export<R>`   | State R: recursive `Values<R>`; else R with `.get()`: its return type; else R |
| `State.Value<T, K>` | Single property value lookup with Export unwrapping                     |

## Extends vs Type

```ts
// Accepts abstract classes too (parameters, lookups)
function lookup<T extends State>(Type: State.Extends<T>): T | undefined;

// Requires concrete class (instantiation)
function create<T extends State>(Type: State.Type<T>): T;
```

## Field

Excludes base State members (`get`, `set`, `is`, etc.):

```ts
class MyState extends State {
  foo = 1; // included in Field<MyState>
  bar = 'hello'; // included
  // get(), set(), is, etc. - excluded
}
```

## Instruction Symbols

Instructions return symbols at definition time; the typed value exists only after initialization:

```ts
class Test extends State {
  value = set<string>(); // TypeScript sees string, runtime sees Symbol until init
}
```

Instruction-specific signatures live in their files under `field/`.
