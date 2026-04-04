# Basic Examples

Complete working examples demonstrating Expressive State fundamentals.

## Counter (minimal)

```tsx
import State from '@expressive/react';

class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}

function CounterApp() {
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

## Todo List (local state with collections)

```tsx
import State, { set } from '@expressive/react';

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

class TodoState extends State {
  items = set<TodoItem[]>([]);
  input = '';
  nextId = 1;

  remaining = set((from) => {
    return from.items.filter((i) => !i.done).length;
  });

  add() {
    if (!this.input.trim()) return;
    this.items = [
      ...this.items,
      { id: this.nextId++, text: this.input, done: false }
    ];
    this.input = '';
  }

  toggle(id: number) {
    this.items = this.items.map((i) =>
      i.id === id ? { ...i, done: !i.done } : i
    );
  }
}

function TodoApp() {
  const state = TodoState.use();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          state.add();
        }}>
        <input
          value={state.input}
          onChange={(e) => (state.input = e.target.value)}
        />
        <button type="submit">Add</button>
      </form>
      <p>{state.remaining} remaining</p>
      <ul>
        {state.items.map((item) => (
          <li key={item.id} onClick={() => state.toggle(item.id)}>
            {item.done ? <s>{item.text}</s> : item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Async Data (with Suspense)

```tsx
import State, { set, Provider } from '@expressive/react';
import { Suspense } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

class UserProfile extends State {
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
  const profile = UserProfile.use({ userId: 1 });

  return (
    <Provider of={profile}>
      <Suspense fallback={<p>Loading...</p>}>
        <Profile />
      </Suspense>
    </Provider>
  );
}
```

## Shared Context (parent/child communication)

```tsx
import State, { get, Provider } from '@expressive/react';

class Theme extends State {
  mode: 'light' | 'dark' = 'light';

  toggle() {
    this.mode = this.mode === 'light' ? 'dark' : 'light';
  }
}

class Panel extends State {
  theme = get(Theme);
  expanded = false;

  toggle() {
    this.expanded = !this.expanded;
  }

  get isDark() {
    return this.theme.mode === 'dark';
  }
}

function App() {
  const theme = Theme.use();

  return (
    <Provider of={theme}>
      <button onClick={theme.toggle}>Toggle Theme</button>
      <PanelView />
    </Provider>
  );
}

function PanelView() {
  const { expanded, toggle, isDark } = Panel.use();

  return (
    <div style={{ background: isDark ? '#333' : '#fff' }}>
      <button onClick={toggle}>{expanded ? 'Collapse' : 'Expand'}</button>
      {expanded && <p>Panel content</p>}
    </div>
  );
}
```

## Component Class (self-rendering)

```tsx
import { Component, set } from '@expressive/react';

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

// Use directly in JSX
function App() {
  return <Search />;
}
```

## Form Validation (setter callbacks)

```tsx
import State, { set } from '@expressive/react';

class SignupForm extends State {
  name = '';
  email = set('', (value) => {
    if (value && !value.includes('@')) throw false; // reject - value stays unchanged
  });
  password = set('', (value) => {
    if (value.length > 0 && value.length < 8) throw false; // reject short passwords
  });

  valid = set((from) => {
    return (
      from.name.length > 0 &&
      from.email.includes('@') &&
      from.password.length >= 8
    );
  });

  submit() {
    if (!this.valid) return;
    console.log('Submitting:', this.get());
  }
}

function Signup() {
  const form = SignupForm.use();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.submit();
      }}>
      <input
        placeholder="Name"
        value={form.name}
        onChange={(e) => (form.name = e.target.value)}
      />
      <input
        placeholder="Email"
        value={form.email}
        onChange={(e) => (form.email = e.target.value)}
      />
      <input
        type="password"
        placeholder="Password (8+ chars)"
        value={form.password}
        onChange={(e) => (form.password = e.target.value)}
      />
      <button disabled={!form.valid}>Sign Up</button>
    </form>
  );
}
```
