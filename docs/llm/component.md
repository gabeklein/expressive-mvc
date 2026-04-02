# Expressive State - Component

`Component` extends `State` and works directly as a React component. It provides reactive rendering, context injection, error boundaries, and subcomponents.

## Basic Usage

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;

  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

// Use directly as JSX
<Counter />;
```

Properties accessed via `this` in `render()` are reactive - changes trigger re-renders automatically.

## Props

State fields can be initialized and updated via JSX attributes (all optional):

```tsx
class Greeting extends Component {
  name = 'World';

  render() {
    return <h1>Hello, {this.name}!</h1>;
  }
}

<Greeting name="React" />;
```

Props are applied to the instance every render. The type is derived from state fields.

### Render Props

Accept extra props (beyond state fields) via a parameter on `render()`:

```tsx
class Card extends Component {
  title = '';

  // `{} as T` required for compatibility with React's intrinsic attributes
  render(props = {} as { className: string }) {
    return <div className={props.className}>{this.title}</div>;
  }
}

<Card title="Hello" className="card" />;
```

Non-optional props in the parameter become required JSX attributes.
All props (state + render + special) are available on `this.props`.

### Special Props

- `is` - callback receiving the instance on creation: `<Counter is={(c) => console.log(c)} />`
- `fallback` - ReactNode shown during suspense and error recovery, overrides instance property

## Children

Without a `render()` method (or when `render()` has no parameter), children are passed through a context provider:

```tsx
class Layout extends Component {
  theme = 'light';
}

<Layout>
  <ChildComponent /> {/* can access Layout via Layout.get() */}
</Layout>;
```

## Context

Component instances are automatically provided to context. Children can access them:

```tsx
class App extends Component {
  user = 'Alice';
}

function Profile() {
  const app = App.get();
  return <p>{app.user}</p>;
}

<App>
  <Profile />
</App>;
```

## Suspense

Set `fallback` to display content while children or `render()` are suspended:

```tsx
class DataView extends Component {
  fallback = (<span>Loading...</span>);
  data = set<string>(); // undefined until set

  render() {
    return <span>{this.data}</span>; // suspends until data is set
  }
}
```

The `fallback` prop on the JSX element overrides the instance property.

## Error Boundaries

Override `catch()` to handle errors thrown by children during render:

```tsx
class SafeView extends Component {
  async catch(error: Error) {
    this.fallback = <span>Something went wrong</span>;
    // While this is pending, fallback is displayed.
    // When resolved, render is retried.
    await reportError(error);
  }

  render() {
    return <RiskyComponent />;
  }
}
```

- Setting `this.fallback` inside `catch()` shows error-specific UI, reverted after recovery.
- If `catch()` rejects, the error propagates to the nearest parent boundary.
- Without `catch()`, errors propagate automatically.
- Sync `catch()` triggers immediate retry.
- If child throws again after recovery, the error propagates out of boundary.

## Subcomponents

Methods starting with a capital letter become reactive React components, scoped to `this`:

```tsx
class Dashboard extends Component {
  items = ['a', 'b', 'c'];
  title = 'My Dashboard';

  Sidebar() {
    return (
      <ul>
        {this.items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    );
  }

  Header() {
    return <h1>{this.title}</h1>;
  }

  render() {
    return (
      <div>
        <this.Header />
        <this.Sidebar />
      </div>
    );
  }
}
```

### Key behaviors

- Each usage subscribes to the parent instance and re-renders on any change.
- Multiple usages of the same subcomponent are independent.
- Accept props like any React component.
- Accessible from context: `Dashboard.get()` then use `<dashboard.Sidebar />`.
- Overridable at runtime via assignment.
- Subclasses can override subcomponents for plug-and-play composition.

### Props on subcomponents

```tsx
class Dashboard extends Component {
  Sidebar(props: { label: string }) {
    return <span>{props.label}</span>;
  }

  render() {
    return <this.Sidebar label="Navigation" />;
  }
}
```

### Subclass composition

```tsx
class Base extends Component {
  Before(): ReactNode {
    return null;
  }
  After(): ReactNode {
    return null;
  }

  render() {
    return (
      <>
        <this.Before />
        <span>Main</span>
        <this.After />
      </>
    );
  }
}

class Page extends Base {
  Before() {
    return <span>Header</span>;
  }
  After() {
    return <span>Footer</span>;
  }
}
```

## Lifecycle

- `new()` - called once after initialization. Return a cleanup function for teardown.
- `use()` - called on every render with props (same as State, see react.md).
- `catch(error)` - error boundary handler.
- Destruction occurs on unmount (or when `this.set(null)` is called).

```tsx
class Timer extends Component {
  elapsed = 0;

  new() {
    const id = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(id);
  }

  render() {
    return <span>{this.elapsed}s</span>;
  }
}
```

## Strict Mode

Component handles React strict mode correctly - only one instance is created despite double-mount.
