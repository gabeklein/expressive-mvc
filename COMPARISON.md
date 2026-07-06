# State Library Comparison — Working Notes / Handoff

Scratch/planning doc for building an at-a-glance comparison between Expressive MVC
and other React state-management approaches. This is a **handoff for another agent**,
not final published content.

## Goal

Produce an at-a-glance comparison that emphasizes Expressive's:
- **Simplicity** and clarity of purpose
- **Lack of glue code** — especially around context and sharing state between components

The comparison is anchored on a concrete, trivial example: a store with three values
`foo` / `bar` / `baz`. The point is to compare what it costs to *bootstrap* the same
reusable unit in each approach, holding the consumer-facing surface constant.

Libraries in scope: Expressive MVC, React Context + `useState` (the "custom hook"
baseline — treated as the primary "before" panel), Zustand, Redux Toolkit, Jotai.
MobX is a candidate to add later (the other class-based comparison / fair fight).

## Two framings developed

### 1. Shared variant (provide once, read from any descendant)

Key contrast: Expressive collapses **declaration, type, provider identity, and
subscription granularity** into one class. Everyone else spells at least a couple of
those out separately. The Context+useState baseline is worst on every axis, making it
the ideal "before" panel.

### 2. Local variant + drop-in hook parity (most recent focus)

Device: **return-shape parity** — make every competitor expose the identical
`useFooBarBaz()` surface returning `{ foo, bar, baz, setFoo, setBar, setBaz }`, so
consumer code is identical and only the *cost to build the reusable unit* differs.
Expressive is presented as a `class FooBarBaz extends State` consumed via
`FooBarBaz.use()` (it needs no setters — writes are plain assignment).

The punchline: **only Expressive gives one artifact that is local AND shareable
without a rewrite, with zero setter boilerplate.** The custom hook wins on local
simplicity but hits a hard cliff at sharing (must rebuild as Context). Zustand/Jotai
blur local vs shared by defaulting to module singletons.

## Code panels (canonical versions to reuse)

### Expressive MVC

```tsx
import State, { Provider } from '@expressive/react';

class FooBarBaz extends State {
  foo = 0;
  bar = '';
  baz = false;
}

// Local, per-mount — no provider, no bootstrap
function Widget() {
  const state = FooBarBaz.use();
  state.foo++;                       // write = assignment
  return <p>{state.foo} {state.bar} {String(state.baz)}</p>;
}

// Shared — SAME class, just provide + get (no rewrite)
function App() {
  return (
    <Provider of={FooBarBaz}>
      <Child />
    </Provider>
  );
}
function Child() {
  const { foo, bar, baz } = FooBarBaz.get();   // subscribes only to fields touched
  return <p>{foo} {bar} {String(baz)}</p>;
}
```

### React Context + useState (baseline "before")

```tsx
import { createContext, useContext, useState, useMemo } from 'react';

interface StoreValue {
  foo: number; bar: string; baz: boolean;
  setFoo: (v: number) => void;
  setBar: (v: string) => void;
  setBaz: (v: boolean) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function StoreProvider({ children }: { children: React.ReactNode }) {
  const [foo, setFoo] = useState(0);
  const [bar, setBar] = useState('');
  const [baz, setBaz] = useState(false);

  const value = useMemo(
    () => ({ foo, bar, baz, setFoo, setBar, setBaz }),
    [foo, bar, baz]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useFooBarBaz() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useFooBarBaz must be used within StoreProvider');
  return ctx;
}
```

Local-only version (no sharing) is just the three `useState` calls returned from a
hook — but it cannot be shared without rebuilding as the Context version above. Local
and shared are two different implementations.

### Zustand

```tsx
import { create } from 'zustand';

const useFooBarBaz = create<{
  foo: number; bar: string; baz: boolean;
  setFoo: (v: number) => void;
  setBar: (v: string) => void;
  setBaz: (v: boolean) => void;
}>((set) => ({
  foo: 0, bar: '', baz: false,
  setFoo: (foo) => set({ foo }),
  setBar: (bar) => set({ bar }),
  setBaz: (baz) => set({ baz }),
}));
```

⚠️ Module singleton — every consumer shares one state. Genuinely local per-mount needs
`useState(() => createStore(...))` + context (more glue, not less). Granular re-render
needs selectors: `useFooBarBaz((s) => s.foo)`.

### Redux Toolkit

```tsx
import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Provider, useSelector, useDispatch } from 'react-redux';

const slice = createSlice({
  name: 'store',
  initialState: { foo: 0, bar: '', baz: false },
  reducers: {
    setFoo: (s, a: PayloadAction<number>) => { s.foo = a.payload; },
    setBar: (s, a: PayloadAction<string>) => { s.bar = a.payload; },
    setBaz: (s, a: PayloadAction<boolean>) => { s.baz = a.payload; },
  },
});

const store = configureStore({ reducer: { store: slice.reducer } });

// Provide: <Provider store={store}>...</Provider>
// Consume: const foo = useSelector((s) => s.store.foo);
// Write:   dispatch(slice.actions.setFoo(1));  // action round-trip
```

No honest local variant — the store is a singleton by design. Only competes in the
shared panel.

### Jotai

```tsx
import { atom, useAtom } from 'jotai';

const fooAtom = atom(0);
const barAtom = atom('');
const bazAtom = atom(false);

function useFooBarBaz() {
  const [foo, setFoo] = useAtom(fooAtom);
  const [bar, setBar] = useAtom(barAtom);
  const [baz, setBaz] = useAtom(bazAtom);
  return { foo, bar, baz, setFoo, setBar, setBaz };
}
```

⚠️ Module atoms are shared. Per-mount-local means minting atoms inside the hook
(`useMemo(() => atom(0), [])` ×3) or scoping with `<Provider>`.

## Summary tables

### Shared (provide once, read anywhere)

| | Declare 3 values | Bootstrap sharing | Consume | Write | Granular re-render |
|---|---|---|---|---|---|
| **Expressive** | 3 fields | `<Provider of={Store}>` | `Store.get()` | `store.foo = 1` | automatic |
| Context+useState | 3 `useState` + interface | custom provider + `useMemo` + guard hook | `useStore()` | `setFoo(1)` | ✗ (all consumers) |
| Zustand | 3 fields + 3 setters | none (global) | `useStore(s => s.foo)` | `setFoo(1)` | via selector |
| Redux Toolkit | slice + 3 reducers | `configureStore` + `<Provider>` | `useSelector` | `dispatch(setFoo(1))` | via selector |
| Jotai | 3 atoms | none (module) | `useAtom` ×3 | `setFoo(1)` | per-atom |

### Local (reusable unit)

| | Reusable unit | Setters written | Per-mount local | Same code when shared? |
|---|---|---|---|---|
| **Expressive** | `class FooBarBaz` | none (assign) | ✅ `.use()` | ✅ add `<Provider>`, `.get()` |
| useState hook | `useFooBarBaz` | 3 (from `useState`) | ✅ | ❌ rebuild as Context |
| Zustand | `useFooBarBaz` | 3 explicit | ❌ singleton | ✅ (but never local) |
| Jotai | `useFooBarBaz` | none (per atom) | ❌ singleton | ⚠️ needs Provider scope |
| Redux | slice + store | 3 reducers | ❌ | — |

## Open / next steps

- **Derived-value row** (not yet built): compare Expressive `get qux() { return this.foo + this.bar.length }`
  (auto-tracked, memoized) vs `useMemo` deps arrays vs Redux `createSelector`/reselect.
  This is the other axis where the class clearly pulls ahead.
- **Render as a side-by-side artifact** — parity of the consumer surface pops visually
  with aligned columns; candidate for README or a landing page.
- **Consider adding MobX** — the other class-based library; a fair fight worth including.
- Keep consumer-facing surface identical across panels (`useFooBarBaz` / `.use()`) so the
  only visible difference is bootstrap cost.

## Source-of-truth references (Expressive API)

- `skills/SKILL.md` — API overview (State, instructions, hooks, Component, Provider)
- `skills/examples/basic.md` — canonical worked examples (Counter, Todo, Shared Context, etc.)
- `skills/state/context.md` — context/ownership model (`.get()`, Provider, root singleton)

Idiom reminders: instantiate via `State.new()` (or `.use()`/`.get()` in React), never
plain `new` in app code; writes are plain field assignment; reactive computed values are
plain class getters; `.get()` subscribes only to the fields actually read.
