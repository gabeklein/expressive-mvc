# `def` - Custom Instruction

Runnable source: [`def`](https://expressive.dev/examples/instructions/def) - a complete working program, served as HTML.

```ts
import { def } from '@expressive/mvc';
```

Low-level primitive for custom property behavior during initialization. Every other instruction (`get`, `set`, `ref`, `map`, `has`) is built on `def`.

## Usage

```ts
class FormState extends Model {
  custom = def((key, subject, state) => {
    // key: property name (string)
    // subject: the instance
    // state: the internal store (Model.Values<T>)
    return { value: computedValue };
  });
}
```

The factory runs during instance initialization (via `Model.on`), after the property's symbol placeholder is deleted.

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

Per-option contract: JSDoc on hover, or `node_modules/@expressive/mvc/dist/field/def.d.ts`.

## Child Instance (No Instruction Needed)

Nest instances by direct assignment (`child = new Child()`) - auto-parented, activated, and destroyed with the parent. See [state.md](../state/state.md#child-instances).
