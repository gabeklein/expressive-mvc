# Model - Type Aliases

Namespace types on `Model` used throughout the API.

## Core Types

| Type                | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `Model.Extends<T>`  | Abstract or concrete constructor - for parameters accepting a class     |
| `Model.Type<T>`     | Concrete (instantiable) constructor - when `new` is required            |
| `Model.Property<T>` | Keys of T excluding inherited Model members                             |
| `Model.Field<T>`    | Managed keys - `Property<T>` less unmanaged `_` keys                    |
| `Model.Event<T>`    | Valid event keys: `Field<T> \| number \| symbol \| (string & {})`       |
| `Model.Args<T>`     | Constructor argument union: `(Args \| Init \| Assign \| void)[]`        |
| `Model.Assign<T>`   | Object overlay - maps properties preserving function `this`             |
| `Model.Values<T>`   | All fields with child models and ref objects unwrapped via `Export<R>`  |
| `Model.Export<R>`   | Model R: recursive `Values<R>`; else R with `.get()`: its return type; else R |
| `Model.Value<T, K>` | Single property value lookup with Export unwrapping                     |

## Extends vs Type

```ts
// Accepts abstract classes too (parameters, lookups)
function lookup<T extends Model>(Type: Model.Extends<T>): T | undefined;

// Requires concrete class (instantiation)
function create<T extends Model>(Type: Model.Type<T>): T;
```

## Property and Field

Both exclude base Model members (`get`, `set`, `is`, etc.). `Field` also excludes unmanaged `_` keys - use it for managed state (`Values`, `ref`, `def`, `has`); `Property` for overlays (`Assign`, props):

```ts
class MyModel extends Model {
  foo = 1; // Property and Field
  _bar = 'hello'; // Property only
  // get(), set(), is, etc. - excluded
}
```

## Instruction Symbols

Instructions return symbols at definition time; the typed value exists only after initialization:

```ts
class Test extends Model {
  value = set<string>(); // TypeScript sees string, runtime sees Symbol until init
}
```

Instruction-specific signatures live in their files under `field/`.
