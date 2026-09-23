# `def` - Custom Instruction

Runnable source: [`def`](https://expressive.dev/examples/instructions/def) - a complete working program, served as HTML.

```ts
import { def } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Low-level primitive for custom property behavior during initialization. Every other instruction (`get`, `set`, `ref`, `map`, `has`) is built on `def`.

## Usage

```ts
class MyState extends State {
  custom = def((key, subject, state) => {
    // key: property name (string)
    // subject: the state instance
    // state: the internal store (State.Values<T>)
    return { value: computedValue };
  });
}
```

The factory runs during instance initialization (via `State.on`), after the property's symbol placeholder is deleted.

## Return Values

```ts
// nothing - side effect only, no property configured
custom = def((key, subject) => {});

// cleanup function - runs on destroy
custom = def((key, subject) => {
  const interval = setInterval(poll, 1000);
  return () => clearInterval(interval);
});

// configuration object
custom = def<string>((key, subject) => ({
  value: 'initial', // initial property value
  enumerable: true, // appear in Object.keys()
  get: (subscriber) => v, // custom getter (receives subscriber if in tracked context)
  set: (next, prev) => {}, // custom setter
  destroy: () => {} // cleanup on destruction
}));
```

| Option | Value | Meaning |
| --- | --- | --- |
| `get` | function | called on access with the subscriber (or the instance if none) |
| | `true` | required - throws suspense if not yet set |
| | `false` | optional - `undefined` if not yet set |
| | `undefined` | no special getter behavior |
| `set` | function | called on assignment with `(next, prev)`; throw `false` to reject, `true` to accept silently; return a value to override |
| | `false` | read-only (throws on assignment) |
| | `undefined` | no special setter behavior |

## Type Signatures

```ts
function def<T>(factory: def.Factory<T>): T;

type def.Factory<T, M extends State> = (
  this: M,
  key: Extract<State.Field<M>, string>,
  thisArg: M,
  state: State.Values<M>
) => def.Config<T> | (() => void) | void;

interface def.Config<T> extends State.Apply<T> {
  destroy?: () => void;
}
```

## Child State (No Instruction Needed)

Nest states by direct assignment (`child = new ChildState()`) - auto-parented, activated, and destroyed with the parent. See [state.md](../state/state.md#child-states).
