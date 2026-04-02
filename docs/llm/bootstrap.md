# Expressive State - Bootstrap for Consumer Projects

Copy this into your project's `CLAUDE.md` or `AGENTS.md`.

---

## Expressive State

This project uses [Expressive State](https://github.com/gabeklein/expressive-mvc), a class-based reactive state management library.

**Packages:**

| Package              | Status    | Description                                    |
| -------------------- | --------- | ---------------------------------------------- |
| `@expressive/react`  | Published | React adapter. Import `State`, `Component`, instructions. |
| `@expressive/state`  | Published | Framework-agnostic core (rarely imported directly). |
| `@expressive/preact` | Private   | Thin wrapper over React adapter using preact/hooks. Same API, own Provider/Consumer. No Component support yet. |
| `@expressive/solid`  | Private   | Standalone implementation. Experimental. See `solid.md`. |

**Quick Reference:**

```tsx
import State, {
  Component,
  ref,
  def,
  get,
  set,
  Provider
} from '@expressive/react';

class MyState extends State {
  count = 0; // reactive property
  data = set(async () => fetchData()); // async with Suspense
  parent = get(ParentState); // context lookup
  element = ref<HTMLElement>(); // mutable ref
  increment() {
    this.count++;
  }
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
  increment() {
    this.count++;
  }
  render() {
    const { count, increment } = this; // reactive access, methods auto-bound
    return <button onClick={increment}>{count}</button>;
  }
}
```

**Full docs** (fetch when needed): react/react.md, state/state.md, state/get.md, state/set.md, state/lifecycle.md, instructions/get.md, instructions/set.md, instructions/ref.md, instructions/def.md, react/component.md, react/patterns.md, state/types.md
