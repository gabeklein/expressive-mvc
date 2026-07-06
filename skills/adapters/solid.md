# Solid Adapter (design notes)

> No `@expressive/solid` package ships yet - this file records the intended adapter design, not published surface.

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
