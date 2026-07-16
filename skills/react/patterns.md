# Expressive MVC — Patterns

Recipes and examples for common patterns and use cases with Expressive MVC in React.

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
import { Component } from '@expressive/react';

class LoginForm extends Component {
  email = '';
  password = '';

  get valid() {
    return this.email.includes('@') && this.password.length >= 8;
  }

  submit() {
    if (this.valid) postLogin(this.email, this.password);
  }

  render() {
    const { email, password, valid, submit } = this;

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}>
        <input
          value={email}
          onChange={(e) => (this.email = e.target.value)}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => (this.password = e.target.value)}
        />
        <button disabled={!valid}>Log In</button>
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

## Contextual Children (No Prop Drilling)

Children of a provided state declare their own dependencies with `.get()`. Do not thread state values and callbacks through props:

```tsx
// Before: parent unpacks state and drills it down
function Wizard() {
  const { step, busy, canContinue, advance, retreat } = TransferState.get();
  return <WizardActions step={step} busy={busy} canContinue={canContinue}
    onNext={advance} onBack={retreat} />;
}

// After: the child is contextual - dependencies are local
function Wizard() {
  return <WizardActions />;
}

function WizardActions() {
  const {
    busy,
    canContinue,
    advance,
    retreat,
  } = TransferState.get();

  return (
    <footer>
      <button onClick={retreat} disabled={busy}>Back</button>
      <button onClick={advance} disabled={!canContinue}>Continue</button>
    </footer>
  );
}
```

Pure presentation components (a `Metric`, a badge) may still take plain props - context replaces drilled state, not every value.

## Presence Boundary

The parent owns whether an optional child exists; the child asserts its requirements with `.get(true)`. Declare the gated field optional (`draft?: T`), not `| null`:

```tsx
class SettingsState extends State {
  draft?: SettingsLocation = undefined;
  saving = false;

  async saveSettings() { ... }
}

function SettingsContent() {
  const { draft } = SettingsState.get();

  return (
    <div className="settings-layout">
      <LocationList />
      {draft && <SettingsEditor />}
    </div>
  );
}

function SettingsEditor() {
  const {
    saveSettings,
    saving,
    draft: {
      bankAccount,
      categoryAccounts,
    },
  } = SettingsState.get(true);

  return <section className="settings-editor">...</section>;
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
