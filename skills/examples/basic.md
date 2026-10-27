# Basic Examples

Working examples of the fundamentals.

## Counter (minimal)

```tsx
import { Component } from '@expressive/mvc';

class Counter extends Component {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }

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

Fields are optional props, applied every render.

## Todo List (owned collection)

Each entry is its own instance in a `has` pool - `done` and `toggle` live on the item, not as `(id, value)` methods on the list:

```tsx
import { Model, Component, has } from '@expressive/mvc';

class TodoItem extends Model {
  text = '';
  done = false;

  toggle() {
    this.done = !this.done;
  }
}

class TodoApp extends Component {
  items = has(TodoItem);
  input = '';

  get remaining() {
    return this.items.filter((i) => !i.done).length;
  }

  add() {
    if (!this.input.trim()) return;
    this.items.add({ text: this.input });
    this.input = '';
  }

  render() {
    const { input, remaining, items, add } = this;

    return (
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}>
          <input
            value={input}
            onChange={(e) => (this.input = e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
        <p>{remaining} remaining</p>
        <ul>
          {items.map((item) => (
            <li key={String(item)} onClick={item.toggle}>
              {item.done ? <s>{item.text}</s> : item.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
```

Rows that paint themselves become `Component` members placed as `{this.items}` - pool recipes in [patterns.md](../react/patterns.md).

## Async Data (with Suspense)

```tsx
import { Model, Component, set } from '@expressive/mvc';

interface User {
  id: number;
  name: string;
  email: string;
}

class UserProfile extends Model {
  userId = set<number>();
  user = set(async () => {
    const res = await fetch(`/api/users/${this.userId}`);
    return res.json() as Promise<User>;
  });
}

function Profile() {
  const { user } = UserProfile.get();
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

function App() {
  return (
    <Component for={UserProfile} userId={1} fallback={<p>Loading...</p>}>
      <Profile />
    </Component>
  );
}
```

## Shared Context (parent/child communication)

```tsx
import { Model, Component, get } from '@expressive/mvc';

class Theme extends Model {
  mode: 'light' | 'dark' = 'light';

  toggle() {
    this.mode = this.mode === 'light' ? 'dark' : 'light';
  }
}

class Panel extends Component {
  theme = get(Theme);
  expanded = false;

  toggle() {
    this.expanded = !this.expanded;
  }

  get isDark() {
    return this.theme.mode === 'dark';
  }

  render() {
    const { expanded, toggle, isDark } = this;

    return (
      <div style={{ background: isDark ? '#333' : '#fff' }}>
        <button onClick={toggle}>{expanded ? 'Collapse' : 'Expand'}</button>
        {expanded && <p>Panel content</p>}
      </div>
    );
  }
}

class App extends Component {
  theme = new Theme();

  render() {
    return (
      <>
        <button onClick={this.theme.toggle}>Toggle Theme</button>
        <Panel />
      </>
    );
  }
}
```

`theme` is provided by the `App` that owns it - `Panel` finds it with `get(Theme)`.

## Component Class (self-rendering)

```tsx
import { Component } from '@expressive/mvc';

class Search extends Component {
  query = '';
  results = [];
  loading = false;

  async search() {
    if (!this.query.trim()) return;
    this.loading = true;
    await fetch(`/api/search?q=${encodeURIComponent(this.query)}`)
      .then((res) => res.json())
      .then((data) => (this.results = data.results));
    this.loading = false;
  }

  render() {
    const { loading, query, results, search } = this;

    return (
      <div>
        <input
          value={query}
          onChange={(e) => (this.query = e.target.value)}
          placeholder="Search..."
        />
        <ul className={loading ? 'dim' : ''}>
          {results.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <button onClick={search} disabled={loading}>
          Search
        </button>
      </div>
    );
  }
}

function App() {
  return <Search />;
}
```

Explicit `loading` keeps previous results visible during refresh - the deliberate alternative to `set(async)` suspense for user-initiated fetches.

## Bounded Stepper (setter callback)

A `set` callback guards writes - `throw false` rejects a value that should never be stored, so callers need no bounds checks:

```tsx
import { Component, set } from '@expressive/mvc';

class Quantity extends Component {
  max = 10;

  value = set(1, (next) => {
    if (!Number.isInteger(next) || next < 1 || next > this.max) throw false;
  });

  render() {
    const { value } = this;

    return (
      <div>
        <button onClick={() => this.value--}>-</button>
        <span>{value}</span>
        <button onClick={() => this.value++}>+</button>
      </div>
    );
  }
}

<Quantity max={5} />;
```

Rejecting suits values that are never valid. Input that is not valid *yet* - a half-typed email - lands, and a getter reports on it: [Form with Validation](../react/patterns.md#form-with-validation).
