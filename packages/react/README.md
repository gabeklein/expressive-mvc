<h1 align="center">@expressive/react</h1>

<p align="center">
  React adapter for Expressive MVC - class-based reactive state.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/react"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Freact.svg"></a>
  <img src="https://img.shields.io/badge/Coverage-100%25-brightgreen.svg">
</p>

---

The React adapter for [Expressive MVC](https://github.com/gabeklein/expressive-mvc). Define state as a class, use it in a component, and reads automatically subscribe - components re-render only when accessed values change.

```bash
npm install @expressive/react react
```

```tsx
import { State } from '@expressive/react';

class Counter extends State {
  count = 0;
  increment = () => this.count++;
  decrement = () => this.count--;
}

function CounterWidget() {
  const { count, increment, decrement } = Counter.use();

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

When the state belongs to one rendered unit, extend `Component` and give it a `render`:

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;
  render() {
    return <button onClick={() => this.count++}>{this.count}</button>;
  }
}

<Counter />;
```

## Shared state via context

Provide a model once; descendants read it with `State.get()` - no props, no selectors.

```tsx
import { Provider } from '@expressive/react';

class Session extends State {
  user = 'guest';
}

function App() {
  return (
    <Provider for={Session}>
      <Profile />
    </Provider>
  );
}

function Profile() {
  const { user } = Session.get();   // nearest Session in context
  return <p>Signed in as {user}</p>;
}
```

**At a glance**

- **`State.use()`** - create an instance bound to a component's lifecycle.
- **`State.get()`** - read shared state from context, no prop drilling.
- **`Provider` / `Consumer`** - explicit hierarchical dependency injection.
- **`Component`** - smart controls and shells whose behavior lives in the tree.
- **Suspense** - async values and promises integrate with React Suspense.
- **`@expressive/react/runtime`** - the host-agnostic runtime layer adapters build on.

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
