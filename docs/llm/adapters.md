# Framework Adapters — Expressive State

## Package Overview

| Package              | Status    | Version |
| -------------------- | --------- | ------- |
| `@expressive/state`  | Published | 0.73.x  |
| `@expressive/react`  | Published | 0.74.x  |
| `@expressive/preact` | Private   | 0.71.x  |
| `@expressive/solid`  | Private   | 0.71.x  |

## React (`@expressive/react`)

Full-featured adapter. See `react.md` for complete API documentation.

## Preact (`@expressive/preact`)

Thin wrapper over the React adapter. Patches `Pragma` with Preact's hooks:

```ts
import { useEffect, useState } from 'preact/hooks';
import { createElement } from 'preact';

Pragma.useEffect = useEffect;
Pragma.useState = useState;
Pragma.createElement = createElement;
```

**API surface is identical to React.** Same `.use()`, `.get()`, Provider, Consumer.

Has its own Provider/Consumer using Preact's context API.

## Solid (`@expressive/solid`)

Standalone implementation - does NOT depend on React adapter.

### Key difference: signal getters

Properties are wrapped as Solid signals. Accessing them requires calling as functions:

```ts
// React / Preact
const { name, age } = MyState.use();
console.log(name, age); // direct values

// Solid
const { name, age } = MyState.use();
console.log(name(), age()); // must call as signal getters
```

### Implementation

Uses `SIGNALS` WeakMap + Proxy:

- Each property gets a `createSignal()` on first access
- Proxy get trap returns signal getter function
- State update listener propagates changes to signals
- Methods and inherited State members pass through unchanged

### Reactive type

```ts
type Reactive<T extends State> = {
  [P in keyof T]: P extends keyof State
    ? T[P] // State methods unchanged
    : T[P] extends (...args: any) => any
      ? T[P] // Functions unchanged
      : () => T[P]; // Properties become getters
};
```
