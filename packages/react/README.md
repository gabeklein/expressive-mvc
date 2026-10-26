<h1 align="center">@expressive/react</h1>

<p align="center">
  React adapter for Expressive MVC - class-based reactive state.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/react"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Freact.svg"></a>
  <a href="https://github.com/gabeklein/expressive-mvc/actions/workflows/coverage.yml"><img alt="Coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fgabeklein%2Fexpressive-mvc%2Fbadges%2Fcoverage.json"></a>
</p>

---

The React adapter for [Expressive MVC](https://github.com/gabeklein/expressive-mvc). Define state as a class, render it as a component, and reads automatically subscribe - components re-render only when accessed values change.

```bash
npm install @expressive/mvc @expressive/react
```

`@expressive/mvc` is a peer dependency: import `Model`, `Component` and instructions from it, and import `@expressive/react` once from your entry so the host registers. Provide an instance to a subtree with `<Component for={Model}>` - `Provider` and `Consumer` were removed. The adapter's re-exports of the core are deprecated.

Works on React DOM, and on React Native and Expo - the adapter imports only `react` and `react/jsx-runtime`, so there is nothing renderer-specific to port. Exercised on an iOS simulator and an Android emulator in both Debug and Release builds, and gated per release on Metro resolution and a Hermes build (Expo SDK 57, React Native 0.86). Under Jest, add `@expressive` to `transformIgnorePatterns`.

```tsx
import { Component } from '@expressive/mvc';

class Counter extends Component {
  count = 0;
  increment = () => this.count++;
  decrement = () => this.count--;

  render() {
    const { count, increment, decrement } = this;

    return (
      <div>
        <button onClick={decrement}>-</button>
        <span>{count}</span>
        <button onClick={increment}>+</button>
      </div>
    );
  }
}

<Counter count={5} />;
```

## Component

`Component` is a `Model` usable in JSX - a persistent class instance with lifecycle, context, suspense, and error handling baked in. Reach for it when state is intrinsic to a rendered unit: form inputs, layout shells, route controls, media players.

```tsx
import { Component } from '@expressive/mvc';

class Counter extends Component {
  count = 0;
  render() {
    return <button onClick={() => this.count++}>{this.count}</button>;
  }
}

<Counter />;
```

Anything read through `this` in `render()` is reactive; the instance survives across renders, so refs, sockets, and Maps held on `this` persist. Model fields also become optional JSX props (`<Counter count={5} />`).

### Subcomponents

PascalCase members become their own reactive React components scoped to the live instance. They read the parent's reactive `this` directly - no props plumbing - yet each is an isolated component with its own hooks and boundary. Subclasses override them to customize pieces without touching behavior.

```tsx
abstract class Toggle extends Component {
  active = false;

  toggle = () => {
    this.active = !this.active;
  };

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

The base owns behavior and structure; subclasses author only the rendering. Override a subcomponent as a **method** when it takes no props, or as an **arrow field** when you want its props type inferred from the base - which is how `@expressive/router`'s [`NavLinks`](https://github.com/gabeklein/expressive-mvc/blob/main/packages/router/README.md#generated-navigation) exposes its overridable `Item` / `List` / `Group` members.

A subclass `render()` replaces the base's like any method - `super.render(props)` wraps it.

### Self-providing context

A `Component` provides *itself* to context automatically - no provider element needed. Both its own render output and any `children` passed in can read it with `get()`.

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

### Props

Model fields become optional JSX props, **merged onto the instance every render** - passing `count={5}` is the same as assigning `this.count = 5`. Extra props beyond fields are read through a parameter on `render`:

```tsx
class Greeting extends Component {
  name = 'World';                                  // -> optional `name` prop

  render(props = {} as { loud?: boolean }) {       // extra render prop
    return <h1>Hello {this.name}{props.loud && '!!!'}</h1>;
  }
}

<Greeting name="React" loud />;
```

Every Component also accepts three special props:

- **`is`** - callback handed the instance once, at creation.
- **`ref`** - standard React ref; set after mount, cleared on unmount.
- **`fallback`** - Suspense/error UI, overriding the instance's own.

### Suspense

A value that isn't ready yet suspends the render; `fallback` shows in the meantime.

```tsx
import { Component, set } from '@expressive/mvc';

class Profile extends Component {
  user = set<User>();              // undefined until set - suspends render
  fallback = <Spinner />;

  render() {
    return <span>{this.user.name}</span>;
  }
}
```

## Shared state via context

Provide an instance once; descendants read it with `Model.get()` - no props, no selectors.

```tsx
import { Component } from '@expressive/mvc';

class Session extends Model {
  user = 'guest';
}

function App() {
  return (
    <Component for={Session}>
      <Profile />
    </Component>
  );
}

function Profile() {
  const { user } = Session.get();   // nearest Session in context
  return <p>Signed in as {user}</p>;
}
```

**At a glance**

- **`Component`** - a class that renders: owns its state, lifecycle and boundaries.
- **`Model.get()`** - read shared state from context, no prop drilling.
- **`<Component for={Model}>`** - explicit hierarchical dependency injection.
- **Suspense & error boundaries** - async values suspend; `catch()` handles child errors.

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
