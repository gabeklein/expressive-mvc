---
'@expressive/react': minor
---

**Breaking:** `Model.use()` is removed, along with the `use()` instance method it called, `UseModel` and `Model.UseArgs`. A function component owns no state - on React as on `@expressive/dom`. Move owned state to a Component, or provide it and read with `.get()`:

```tsx
// before
function Counter() {
  const { count, increment } = CounterState.use();
  return <button onClick={increment}>{count}</button>;
}

// after
class Counter extends Component {
  count = 0;
  increment() { this.count++; }
  render() {
    const { count, increment } = this;
    return <button onClick={increment}>{count}</button>;
  }
}
```

Shared state: `<Component for={CounterState}>` above function components calling `CounterState.get()`. Hooks a `use()` method bridged move to an outer function component passing props, or to the top of `render()`. `mount()` still runs for a Component, or a Model placed with `<Component for>`. `Component.use()` no longer throws a dedicated error - it is simply absent.
