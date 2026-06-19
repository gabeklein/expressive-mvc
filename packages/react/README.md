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

## Component

`Component` is a `State` that owns its own rendering - a persistent class instance with lifecycle, context, suspense, and error handling baked in. Reach for it when state is intrinsic to a rendered unit: form controls, layout shells, route controllers, media players.

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

Anything read through `this` in `render()` is reactive; the instance survives across renders, so refs, sockets, and Maps held on `this` persist. State fields also become optional JSX props (`<Counter count={5} />`).

### Render composition

When a subclass overrides `render()`, it **composes** with its base rather than replacing it - no `super.render()`. Each `render()` up the prototype chain wraps the one below, base-outermost, with the inner output arriving as `props.children`.

```tsx
class Frame extends Component {
  render(props = {} as { children?: React.ReactNode }) {
    return (
      <section className="frame">
        <header>Frame</header>
        {props.children}
      </section>
    );
  }
}

class Page extends Frame {
  body = 'Hello';
  render() {
    return <p>{this.body}</p>;
  }
}

// <Page /> -> <section class="frame"><header>Frame</header><p>Hello</p></section>
```

Every layer binds to the same live instance, so all read the same reactive `this`. A base that wraps must declare a `props` parameter and render `props.children` - a layer that ignores it silently drops everything below. (A base can also choose to *defer* to a subclass's render, e.g. a leaf `<a>` that's overridable; the base detects the subclass content by identity and returns it as-is.)

### Subcomponents

PascalCase members become their own reactive React components scoped to the live instance. They read the parent's reactive `this` directly - no props plumbing - yet each is an isolated component with its own hooks and boundary. Subclasses override them to customize pieces without touching behavior.

```tsx
abstract class Toggle extends Component {
  active = false;
  toggle = () => (this.active = !this.active);

  Active() { return null; }       // subclasses fill these in
  Inactive() { return null; }

  render() {
    return (
      <div onClick={this.toggle}>
        {this.active ? <this.Active /> : <this.Inactive />}
      </div>
    );
  }
}

class DarkModeSwitch extends Toggle {
  Active() { return <span>Dark</span>; }
  Inactive() { return <span>Light</span>; }
}
```

The base owns behavior and structure; subclasses author only the rendering. This is the same mechanism `@expressive/router`'s `NavLinks` exposes through its overridable `Item` / `List` / `Group` members.

### Self-providing context

A `Component` provides *itself* to context automatically - no `Provider` needed. Both its own render output and any `children` passed in can read it with `get()`.

```tsx
class Tabs extends Component {
  active = 0;
  render(props = {} as { children?: React.ReactNode }) {
    return <div className="tabs">{props.children}</div>;
  }
}

function Tab({ index, label }: { index: number; label: string }) {
  const tabs = Tabs.get();              // reads the enclosing Tabs instance
  return (
    <button
      className={tabs.active === index ? 'on' : undefined}
      onClick={() => (tabs.active = index)}>
      {label}
    </button>
  );
}

<Tabs>
  <Tab index={0} label="One" />
  <Tab index={1} label="Two" />
</Tabs>;
```

It works the same whether the consumer is part of the Component's own render or is passed in as `children` - both sit under the instance's context. A render-less `Component` still self-provides, which is what makes it useful purely as a context/boundary placement.

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
