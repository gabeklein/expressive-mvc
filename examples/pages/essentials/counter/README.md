# Counter

The smallest complete Expressive MVC component: one class that is both the
state and the view.

## What to try

Use `+` and `−` to change the count, and **click the number itself** to reset
it to 1. All three go through methods on the class - there is no handler
plumbing in the markup.

## What it teaches

**A class with `render()`, not a class component.** No `setState`, no
lifecycle methods, no `useState` / `useCallback` / `useMemo`, no dependency
arrays. The only thing it shares with the class components you were told to
avoid is the keyword.

**Fields are the state.** `current = 1` is a reactive field. Assigning it -
`this.current++` - is the update; the view re-renders because `render()` read
it. Nothing declares a dependency.

**Methods are auto-bound.** `increment`, `decrement` and `reset` are declared
methods, not arrow properties. Binding is intrinsic to the class rather than
lexical to the constructor, which is why `render()` can destructure them off
`this` and pass them straight to `onClick`.

**The class is the element.** `<Counter />` needs no hook, no provider and no
wrapper - `Component` is a React component whose instance is its own state.

## Where to look next

- **Computed** derives a value from fields instead of storing it.
- **Context** shares one instance across a subtree, once one component is no
  longer enough.
