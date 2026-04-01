# Expressive State - Component

`Component` extends `State` and is used directly as a React class component. It provides reactive rendering, context injection, error boundaries, and subcomponents.

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

State fields can be set via JSX attributes:

```tsx
class Greeting extends Component {
  name = 'World';

  render() {
    return <h1>Hello, {this.name}!</h1>;
  }
}

<Greeting name="React" />;
```

### Render Props

Accept extra props (not state fields) via a parameter on `render()`:

```tsx
class Card extends Component {
  title = '';

  render(props = {} as { className: string }) {
    return <div className={props.className}>{this.title}</div>;
  }
}

<Card title="Hello" className="card" />;
```

Props declared as non-optional will be required in JSX. All props are available on `this.props`.

### Special Props

- `is` - callback receiving the instance on creation: `<Counter is={(c) => console.log(c)} />`
- `fallback` - ReactNode shown during suspense and error recovery

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

- Each usage has its own reactive scope - only re-renders when its accessed properties change.
- Multiple usages of the same subcomponent are independent:

```tsx
render() {
  return (
    <>
      <this.Display which="a" /> {/* subscribes to this.x */}
      <this.Display which="b" /> {/* subscribes to this.y */}
    </>
  );
}
```

- Accessible from context via `get()`:

```tsx
function Child() {
  const { Sidebar } = Dashboard.get();
  return <Sidebar />;
}
```

- Overridable at runtime via assignment:

```tsx
instance.Sidebar = function () {
  return <span>Custom sidebar</span>;
};
```

- Subclasses can override subcomponents for plug-and-play composition:

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

### Props on subcomponents

Subcomponents accept props like any React component:

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

## Lifecycle

- `new()` - called once during construction. Return a cleanup function for teardown.
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
