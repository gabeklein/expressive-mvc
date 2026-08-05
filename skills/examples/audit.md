# Audit Guide: Evaluating Expressive MVC for a Codebase

Use this guide when helping a user determine if Expressive MVC is a good fit for their project, or when reviewing components for migration candidates.

## Quick Assessment

Ask these questions about the codebase or component:

1. **Hook density** - Does the component use 3+ hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)?
2. **Related state** - Are there multiple `useState` calls that change together or depend on each other?
3. **Effect chains** - Do effects trigger other effects, or sync state between hooks?
4. **Context boilerplate** - Is `createContext` + `useContext` + Provider pattern repeated for state sharing?
5. **Logic in JSX** - Is business logic (validation, transformation, coordination) mixed into the render body?

Three or more yes answers justify a deeper ownership audit; they are a heuristic, not an adoption verdict. Name the concrete cost in the current code before recommending a migration.

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

- Components with 0-2 simple `useState` calls (give user option how aggressive to be with small components)
- Pure display components with no state
- Components where all state comes from server (RSC, SSR, data fetching libraries)
- One-off local UI state (open/closed, hover, scroll position)

## Migration Strategy

1. **Start small** - pick one complex component, then decide whether its behavior belongs in a `Component` or a display-agnostic `State`
2. **Coexist** - Expressive MVC works alongside existing hooks, no need to migrate everything
3. **Bottom-up when coexisting** - migrate leaf components first, then work up to shared state. A one-shot conversion of a whole surface inverts this: route/page controllers first, domain pools second, mature leaf widgets last (see the refactor guide)
4. **Test independently** - state classes can be tested without React, use this to improve coverage

## After Selection

This guide identifies candidates; it does not define the conversion. Once a migration is approved, follow [the refactor guide](../react/refactor.md) for ownership triage, hook mapping, dependency snapshots, and the review rubric.

## Design Questions

Do not infer intent or turn unfamiliar syntax into a fit finding. Use [the recorded design decisions](../design.md) for classes, the MVC name, `get`/`set`, render composition, and lifecycle hooks. Keep adoption arguments and head-to-head positioning in the website-only [why](https://expressive.dev/llm/why.md) and [comparisons](https://expressive.dev/llm/comparisons.md) pages.

## Red Flags (when NOT to recommend)

- Team has strong preference for functional-only code
- Existing state solution is working without pain
- App is primarily server-rendered with minimal client interactivity (server rendering itself is supported - the flag is having little client state to own)
- Project is in maintenance mode with no active feature work
- Team is unfamiliar with classes and would face a learning curve during a deadline
