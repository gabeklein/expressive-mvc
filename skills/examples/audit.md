# Audit Guide: Evaluating Expressive MVC for a Codebase

For judging whether Expressive MVC fits a project, or finding migration candidates.

## Quick Assessment

Per codebase or component:

1. **Hook density** - 3+ hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)?
2. **Related state** - several `useState` calls that change together or depend on each other?
3. **Effect chains** - effects triggering other effects, or syncing state between hooks?
4. **Context boilerplate** - `createContext` + `useContext` + Provider repeated for state sharing?
5. **Logic in JSX** - business logic (validation, transformation, coordination) in the render body?

Three or more yeses justify a deeper ownership audit - a heuristic, not an adoption verdict. Name the concrete cost in the current code before recommending migration.

Then decide the shape:

- Intrinsic to display logic - `Component`.
- Headless model/controller state - `State`, even when contextual.
- React tree placement is the feature (Boundary, Route) - `Component`, even with little UI.
- Trivial and local - leave as hooks.

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

- Components with 0-2 simple `useState` calls (let the user choose how aggressive to be with small components)
- Pure display components with no state
- Components where all state comes from server (RSC, SSR, data fetching libraries)
- One-off local UI state (open/closed, hover, scroll position)

## Migration Strategy

1. **Start small** - one complex component; decide whether its behavior belongs in a `Component` or a display-agnostic `State`.
2. **Coexist** - works alongside existing hooks; no need to migrate everything.
3. **Bottom-up when coexisting** - leaf components first, then shared state. A one-shot conversion inverts this: route/page controllers, then domain pools, then mature leaf widgets (see the refactor guide).
4. **Test independently** - state classes test without React; use this to raise coverage.

## After Selection

This guide finds candidates, not the conversion. Once a migration is approved, follow [the refactor guide](../react/refactor.md) for ownership triage, hook mapping, dependency snapshots, and the review rubric.

## Design Questions

Do not infer intent or turn unfamiliar syntax into a fit finding. [The recorded design decisions](../design.md) cover classes, the MVC name, `get`/`set`, render composition, and lifecycle hooks. Adoption arguments and head-to-head positioning belong in the website-only [why](https://expressive.dev/llm/why.md) and [comparisons](https://expressive.dev/llm/comparisons.md) pages.

## Red Flags (when NOT to recommend)

- Team strongly prefers functional-only code
- Existing state solution works without pain
- App is mostly server-rendered with little client interactivity (server rendering is supported - the flag is having little client state to own)
- Project is in maintenance mode, no active feature work
- Team is unfamiliar with classes and facing a deadline
