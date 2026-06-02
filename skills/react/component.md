# Expressive MVC - Component

`Component` extends `State` to create **smart, reusable React components** - persistent class instances that own their rendering, lifecycle, and behavior.

## When to use Component vs State vs function components

- **Function components** are dumb - they receive data, render UI. Keep them simple.
- **State** is display-agnostic - pure data and logic, no render method. Use with `State.use()` in function components to separate concerns.
- **Component** is for **custom components/primitives** that own their display logic. They're _meant_ to render. Use when you need a reusable, extensible unit combining behavior + UI: form controls, media players, data grids, modals, layout shells.

Rule of thumb: use `Component` when state is intrinsic to display logic. Usually that means defining `render()`.

A Component does not have to define `render()`: without one, it passes children through while still providing itself to context and acting as Suspense/ErrorBoundary placement. Use that headless form only when React tree placement is the feature: route controllers inserted throughout an app, progressive `Boundary` wrappers, or Suspense/ErrorBoundary placement.

Use `State` for headless models/controllers, even if they are only meaningful in context. A `Component` carries React instance properties (`props`, `state`, `context`, `setState`, `forceUpdate`), so using it where `State` would suffice makes `.get()` noisier.

For one-shot feature builds and hook refactors, avoid creating `FooState` plus `FooView` by reflex. A route shell, local router, tab panel, menu, editor surface, media player, or custom form control is often clearer as `class Foo extends Component` because the state is intrinsic to the rendered unit.

Components are scaffolding. You build one once with lifecycle, reactivity, context, suspense, and error handling baked in - then you or your team extend/configure it. What would be a complicated arrangement of hooks to accomplish one purpose becomes a class you subclass and fill in.

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

<Counter />;
```

Properties accessed via `this` in `render()` are reactive - changes trigger re-renders automatically.

## Inheritance and Custom Primitives

The primary power of Component: build reusable base classes, extend to specialize.

```tsx
abstract class Toggle extends Component {
  active = false;

  toggle() {
    this.active = !this.active;
  }

  // Subclasses override to customize each state
  Active(): ReactNode {
    return null;
  }
  Inactive(): ReactNode {
    return null;
  }

  render() {
    return (
      <div onClick={this.toggle}>
        {this.active ? <this.Active /> : <this.Inactive />}
      </div>
    );
  }
}

// Team members extend without reimplementing toggle logic
class DarkModeSwitch extends Toggle {
  Active() {
    return <span>Dark</span>;
  }
  Inactive() {
    return <span>Light</span>;
  }
}

class Accordion extends Toggle {
  title = 'Details';

  Inactive() {
    return <h3>{this.title}</h3>;
  }
  Active() {
    return (
      <>
        <h3>{this.title}</h3>
        <div>{this.props.children}</div>
      </>
    );
  }
}
```

Key pattern: base class owns behavior + structure, subclass fills in rendering. Subclasses work immediately as `<DarkModeSwitch />` or `<Accordion title="FAQ">...</Accordion>`.

## Persistent Instance

Component instances survive across renders. `this` is stable - you can store references, pass `this` to external objects, hold imperative state (Sets, Maps, DOM refs) without losing it.

```tsx
class ChatRoom extends Component {
  messages: Message[] = [];
  socket: WebSocket | null = null;

  url = '';

  new() {
    this.socket = new WebSocket(this.url);
    this.socket.onmessage = (e) => {
      this.messages = [...this.messages, JSON.parse(e.data)];
    };
    return () => this.socket?.close();
  }

  render() {
    return (
      <ul>
        {this.messages.map((m) => (
          <li key={m.id}>{m.text}</li>
        ))}
      </ul>
    );
  }
}
```

External code can hold a reference via `is` prop (construction-time, fires once): `<ChatRoom is={c => controller = c} />`.

Standard React `ref` also works - Component is a real class component, so `ref` receives the instance after mount and clears to `null` on unmount: `<ChatRoom ref={chatRef} />`. Use `is` when you need the instance during construction; use `ref` for post-mount imperative access following React conventions.

## Props

State fields become optional JSX props. Applied to instance every render.

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

Extra props (beyond state fields) via parameter on `render()`:

```tsx
class Card extends Component {
  title = '';

  render(props = {} as { className: string }) {
    return <div className={props.className}>{this.title}</div>;
  }
}

<Card title="Hello" className="card" />;
```

Non-optional render props become required JSX attributes.
All props (state + render + special) available on `this.props`.

### Special Props

- `is` - callback receiving instance on creation: `<Counter is={c => ref = c} />`
- `ref` - standard React ref (object or callback), attached after mount, cleared on unmount
- `fallback` - ReactNode for suspense/error UI, overrides instance property

## Children and Context

Component instances auto-provide to React context. Without explicit `render()`, children simply pass through provider:

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

`fallback` displays while render or children are suspended:

```tsx
class DataView extends Component {
  data = set<string>(); // undefined until set - suspends render

  fallback = (<span>Loading...</span>);

  render() {
    return <span>{this.data}</span>;
  }
}
```

## Error Boundaries

Override `catch()` to handle child render errors:

```tsx
class SafeView extends Component {
  async catch(error: Error) {
    this.fallback = <span>Something went wrong</span>;
    // Fallback shown while pending. On resolve, render retries.
    await reportError(error);
  }

  render() {
    return <RiskyComponent />;
  }
}
```

- `this.fallback` in `catch()` shows error UI, reverted after recovery.
- Rejected `catch()` propagates to parent boundary.
- Sync `catch()` triggers immediate retry.
- Repeated throw after recovery propagates out.

## Subcomponents

PascalCase methods become reactive React components scoped to `this`:

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

- Each usage subscribes to parent, re-renders on change.
- Accept props like any component.
- Accessible from context: `Dashboard.get()` then `<dashboard.Sidebar />`.
- **Overridable by subclasses** for plug-and-play composition.

## Lifecycle

- `new()` - once after init. Return cleanup function for teardown.
- `use()` - every render (same as State).
- `catch(error)` - error boundary.
- Destruction on unmount or `this.set(null)`.

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

## ref() for DOM Access

`ref()` returns a ref callback that triggers imperative setup. Return a cleanup function.

```tsx
class VideoPlayer extends Component {
  element = ref<HTMLVideoElement>((el) => {
    el.play();
    return () => el.pause();
  });

  render() {
    return <video ref={this.element} src={this.src} />;
  }

  src = '';
}
```

## Strict Mode

Handles React strict mode correctly - one instance despite double-mount.
