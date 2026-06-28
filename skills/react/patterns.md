# Expressive MVC — Patterns

Recipies and examples for common patterns and use cases with Expressive MVC in React.

## Counter

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }
  decrement() {
    this.count--;
  }

  render() {
    return (
      <div>
        <button onClick={this.decrement}>-</button>
        <span>{this.count}</span>
        <button onClick={this.increment}>+</button>
      </div>
    );
  }
}
```

## Form with Validation

```tsx
import { Component, set } from '@expressive/react';

class LoginForm extends Component {
  email = set('', (v) => {
    if (!v.includes('@')) return false;
  });
  password = set('', (v) => {
    if (v.length < 8) return false;
  });
  get valid() {
    return !!this.email && !!this.password;
  }

  submit() {
    if (this.valid) postLogin(this.email, this.password);
  }

  render() {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          this.submit();
        }}>
        <input
          value={this.email}
          onChange={(e) => (this.email = e.target.value)}
        />
        <input
          type="password"
          value={this.password}
          onChange={(e) => (this.password = e.target.value)}
        />
        <button disabled={!this.valid}>Log In</button>
      </form>
    );
  }
}
```

## Async Data Fetching

```tsx
import { Component, set } from '@expressive/react';

class Profile extends Component {
  fallback = (<p>Loading...</p>);
  data = set(async () => {
    const res = await fetch('/api/user');
    return res.json();
  });

  render() {
    return (
      <div>
        <h1>{this.data.name}</h1>
        <p>{this.data.email}</p>
      </div>
    );
  }
}
```

## Nested / Child State

```tsx
import State, { Component } from '@expressive/react';

class TodoItem extends State {
  text = '';
  done = false;
  toggle() {
    this.done = !this.done;
  }
}

class TodoList extends Component {
  items: TodoItem[] = [];

  add(text: string) {
    const item = TodoItem.new();
    item.text = text;
    this.items = [...this.items, item];
  }

  render() {
    return (
      <ul>
        {this.items.map((item) => (
          <li
            key={item.text}
            onClick={item.toggle}
            style={{ textDecoration: item.done ? 'line-through' : 'none' }}>
            {item.text}
          </li>
        ))}
        <button onClick={() => this.add('New item')}>Add</button>
      </ul>
    );
  }
}
```

## Context Sharing

```tsx
import State, { Component, get, Provider } from '@expressive/react';

class Theme extends State {
  color = 'blue';
  toggle() {
    this.color = this.color === 'blue' ? 'red' : 'blue';
  }
}

class ThemedWidget extends Component {
  theme = get(Theme);

  render() {
    return (
      <div style={{ color: this.theme.color }}>
        Themed content
        <button onClick={this.theme.toggle}>Toggle</button>
      </div>
    );
  }
}

function App() {
  return (
    <Provider for={Theme}>
      <ThemedWidget />
    </Provider>
  );
}
```

## Computed Values

```tsx
import { Component } from '@expressive/react';

class Cart extends Component {
  items: { name: string; price: number; qty: number }[] = [];

  get total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  get count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  }

  add(name: string, price: number) {
    this.items = [...this.items, { name, price, qty: 1 }];
  }

  render() {
    return (
      <div>
        <p>
          {this.count} items - ${this.total}
        </p>
      </div>
    );
  }
}
```

## Reusable Primitive (subclass to specialize)

A base Component owns behavior; subclasses fill in only what differs. This is the "build once, team extends" story - see `./component.md` for the full inheritance and render-composition model.

```tsx
import { Component } from '@expressive/react';

// Base owns open/close behavior, backdrop, and escape handling.
abstract class Dialog extends Component {
  open = false;

  show() { this.open = true; }
  close() { this.open = false; }

  protected new() {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && this.close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }

  abstract Body(): Component.Node;

  render() {
    if (!this.open) return null;
    return (
      <div className="backdrop" onClick={this.close}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <this.Body />
        </div>
      </div>
    );
  }
}

// Subclass authors only its content; behavior is inherited.
class ConfirmDialog extends Dialog {
  message = 'Are you sure?';
  onConfirm = () => {};

  Body() {
    return (
      <>
        <p>{this.message}</p>
        <button onClick={() => { this.onConfirm(); this.close(); }}>Confirm</button>
        <button onClick={this.close}>Cancel</button>
      </>
    );
  }
}
```

## Headless Boundary (tree placement, no render)

A Component without `render()` passes children through while still providing itself to context and acting as Suspense/ErrorBoundary placement. Use it when React tree position is the feature - route shells, progressive boundaries, contextual owners.

```tsx
import { Component } from '@expressive/react';

class Section extends Component {
  fallback = (<Spinner />); // suspense placement for everything below
  error: Error | null = null;

  // Error boundary: handle the throw, set fallback for error-specific UI.
  catch(error: Error) {
    this.error = error;
    this.fallback = <ErrorPanel error={error} />;
  }
  // no render() - children render in place, this instance is in context
}

// <Section><AsyncChild /></Section>
// Async work in AsyncChild suspends to Section's fallback; a throw runs catch().
```

## Debounced Search

```ts
import State, { set } from '@expressive/react';

class Search extends State {
  query = '';
  results: string[] = [];

  debouncedQuery = set('', (value) => {
    const timer = setTimeout(() => this.performSearch(value), 300);
    return () => clearTimeout(timer);
  });

  async performSearch(q: string) {
    const res = await fetch(`/api/search?q=${q}`);
    this.results = await res.json();
  }
}
```

## Downstream Collection

```tsx
import State, { Component, get } from '@expressive/react';

class Tab extends State {
  label = '';
  group = get(TabGroup);
}

class TabGroup extends Component {
  tabs = get(Tab, true); // collects all Tab instances below
  active = 0;

  render() {
    return (
      <div>
        {this.tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => (this.active = i)}
            style={{ fontWeight: this.active === i ? 'bold' : 'normal' }}>
            {tab.label}
          </button>
        ))}
      </div>
    );
  }
}
```

## Refactoring Hooks Into State

When converting React hooks, avoid a literal hook-for-field rewrite. Put mutable inputs in fields, derived values in getters, setup/cleanup in `new()`, and event handlers in methods.

```tsx
// Before: width is source state, compact is derived state kept in sync.
function LayoutBadge() {
  const [width, setWidth] = useState(window.innerWidth);
  const [compact, setCompact] = useState(width < 720);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setCompact(width < 720);
  }, [width]);

  return <span>{compact ? 'Compact' : `Wide (${width}px)`}</span>;
}
```

```tsx
// After: width is the source field, compact is a getter, and resize belongs to Viewport.
import State from '@expressive/react';

class Viewport extends State {
  width = window.innerWidth;

  get compact() {
    return this.width < 720;
  }

  protected new() {
    const update = () => {
      this.width = window.innerWidth;
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }
}

function LayoutBadge() {
  const { width, compact } = Viewport.use();

  return <span>{compact ? 'Compact' : `Wide (${width}px)`}</span>;
}
```

## Effects & Cleanup

```ts
import State from '@expressive/react';

class Timer extends State {
  elapsed = 0;
  protected new() {
    const id = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(id);
  }
}
```

## Using State.get() with Computed Hook

```tsx
function OrderSummary() {
  const summary = Cart.get(($) => ({
    total: $.total,
    count: $.count,
    empty: $.items.length === 0
  }));

  if (summary.empty) return <p>Cart is empty</p>;
  return (
    <div>
      <p>{summary.count} items</p>
      <p>Total: ${summary.total}</p>
    </div>
  );
}
```
