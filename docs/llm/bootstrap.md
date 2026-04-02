# Expressive State - Bootstrap for Consumer Projects

Copy this into your project's `CLAUDE.md` or `AGENTS.md`.

---

## Expressive State

This project uses [Expressive State](https://github.com/gabeklein/expressive-mvc), a class-based reactive state management library.

**Packages:**

- `@expressive/react` - React adapter. Import `State` (default), `Component`, plus `ref`, `def`, `get`, `set` instructions.
- `@expressive/state` - Framework-agnostic core (rarely imported directly in React projects).

**Quick Reference:**

```tsx
import State, { Component, ref, def, get, set, Provider } from '@expressive/react';

class MyState extends State {
  count = 0; // reactive property
  data = set(async () => fetchData()); // async with Suspense
  parent = get(ParentState); // context lookup
  element = ref<HTMLElement>(); // mutable ref
  increment() { this.count++; }
}

// Hook - local state
function MyComponent() {
  const state = MyState.use();
  return <div>{state.count}</div>;
}

// Hook - context state
function Child() {
  const state = MyState.get();
  return <div>{state.count}</div>;
}

// Component class - reactive, provides context, supports suspense & error boundaries
class CounterView extends Component {
  count = 0;
  increment() { this.count++; }
  render() { return <button onClick={this.increment}>{this.count}</button>; }
}
```

**Full docs** (fetch when needed): react.md, core.md, instructions.md, component.md, patterns.md, lifecycle.md, typescript.md, testing.md, adapters.md
