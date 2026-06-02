# Audit Guide: Evaluating Expressive MVC for a Codebase

Use this guide when helping a user determine if Expressive MVC is a good fit for their project, or when reviewing components for migration candidates.

## Quick Assessment

Ask these questions about the codebase or component:

1. **Hook density** - Does the component use 3+ hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)?
2. **Related state** - Are there multiple `useState` calls that change together or depend on each other?
3. **Effect chains** - Do effects trigger other effects, or sync state between hooks?
4. **Context boilerplate** - Is `createContext` + `useContext` + Provider pattern repeated for state sharing?
5. **Logic in JSX** - Is business logic (validation, transformation, coordination) mixed into the render body?

**Score: 3+ yes answers = strong candidate for Expressive MVC.**

Then decide the shape:

- If state is intrinsic to display logic, use `Component`.
- If it is headless model/controller state, use `State`, even when it is contextual.
- If React tree placement is the feature (Boundary, Route), `Component` can be valid without much UI.
- If the state is trivial and local, leave it as hooks.

## What to Look For

### High-value migration targets

**Scattered related state:**

```tsx
// Before - 5 hooks, logic spread across component
function UserSettings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(name !== original.name || email !== original.email);
  }, [name, email]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateUser({ name, email });
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [name, email]);

  // ... render
}
```

```tsx
// After - cohesive state class, testable independently
class UserSettings extends State {
  name = '';
  email = '';
  saving = false;
  error = set<string | null>(null);

  get dirty() {
    return this.name !== original.name || this.email !== original.email;
  }

  async save() {
    this.saving = true;
    this.error = null;
    try {
      await api.updateUser({ name: this.name, email: this.email });
      // dirty recomputes automatically
    } catch (e) {
      this.error = e.message;
    } finally {
      this.saving = false;
    }
  }
}

function UserSettingsView() {
  const { name, email, saving, error, dirty, save } = UserSettings.use();
  // ... render (pure presentation)
}
```

**Context sharing with re-render problems:**

```tsx
// Before - all consumers re-render on any change
const AppContext = createContext<{
  user: User;
  theme: Theme;
  notifications: Notification[];
  setUser: (u: User) => void;
  setTheme: (t: Theme) => void;
  // ...
}>(null!);
```

```tsx
// After - consumers only re-render for fields they access
class AppState extends State {
  user = set<User>();
  theme: 'light' | 'dark' = 'light';
  notifications = set<Notification[]>([]);
}

// This component only re-renders when theme changes
function ThemeToggle() {
  const { theme } = AppState.get();
  return <button>{theme}</button>;
}
```

### Low-value targets (leave as-is)

- Components with 0-2 simple `useState` calls (give user option how agressive to be with small components)
- Pure display components with no state
- Components where all state comes from server (RSC, SSR, data fetching libraries)
- One-off local UI state (open/closed, hover, scroll position)

## Migration Strategy

1. **Start small** - pick one complex component, then decide whether its behavior belongs in a `Component` or a display-agnostic `State`
2. **Coexist** - Expressive MVC works alongside existing hooks, no need to migrate everything
3. **Bottom-up** - migrate leaf components first, then work up to shared state
4. **Test independently** - state classes can be tested without React, use this to improve coverage

## Refactor Heuristic

For a one-shot hook migration, do not mirror React hooks mechanically. First identify the stateful concept the component is managing, then decide its owner:

- Use `Component` when the concept is display-intrinsic or needs React tree placement.
- Use `State` when the concept is headless, even if it is provided through context.

- `useState` values written directly by inputs, timers, subscriptions, or network callbacks become class fields.
- `useMemo` values and `useEffect` values that only keep state in sync become class getters.
- `useEffect` setup/teardown subscriptions become `protected new()` with a returned cleanup.
- `useCallback` handlers become class methods; methods are auto-bound.
- A `Component` refactor should render with `this`; a `State` refactor should leave the React component as a thin projection over `State.use()` or `State.get()`.

Prefer this:

```tsx
class FormState extends State {
  name = '';
  email = '';
  saving = false;

  get dirty() {
    return this.name !== original.name || this.email !== original.email;
  }

  async save() {
    this.saving = true;
    await api.updateUser({ name: this.name, email: this.email });
    this.saving = false;
  }
}
```

Over this:

```tsx
class FormState extends State {
  name = '';
  email = '';
  dirty = false;

  syncDirty() {
    this.dirty = this.name !== original.name || this.email !== original.email;
  }
}
```

## Red Flags (when NOT to recommend)

- Team has strong preference for functional-only code
- Existing state solution is working without pain
- App is primarily server-rendered with minimal client interactivity
- Project is in maintenance mode with no active feature work
- Team is unfamiliar with classes and would face a learning curve during a deadline
