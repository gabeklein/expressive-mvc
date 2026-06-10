# Feature: Suspense-aware navigation + screen transitions

> Working doc. When shipped, fold the durable parts into PLAN.md and delete this
> file (same lifecycle as the matching REFACTOR.md).
>
> **🚩 FLAG** = a decision needing confirmation.

## 1. What it's for

Two related capabilities about *when* and *how* a navigation presents:

- **Deferred presentation** - wait for a navigated page to be ready before
  swapping, so you never flash a blank or a loading state on in-app navigation.
  Keep the current screen up until the next is ready.
- **Screen transitions** - first-class but **unopinionated** support for
  animating between screens (cross-fade, shared-element, slide). The router only
  brackets the navigation; the app owns the visuals.

Both opt-in, both opinion-free at the base.

## 2. Model: one overridable seam on the Router

Consistent with how `NavLinks` (Item/Group) and Route's proposed `Layout`
members work - behavior lives as members on the class; the base ships thin
boilerplate; a subclass customizes. `goto` brackets every navigation:

```ts
goto(to, replace?) {
  this.transition(() => /* mutate path */);
}

// BrowserRouter default: deferred presentation, no animation.
protected transition(commit: () => void) {
  startTransition(() => {
    commit();      // silent path update - set(assign, true)
    this.set();    // synchronous emit, inside the transition (see §4)
  });
}
```

A user `class MyRouter extends BrowserRouter` (or `extends Router` for another
host) overrides `transition` and/or render members to decide *how* a navigation
plays out. **One seam, two layers:** base = deferred presentation; subclass =
deferral + animation.

## 3. Requirements (what it leans on)

- **Component auto-Suspense (already exists).** Every `@expressive/react`
  Component wraps itself in `<Suspense fallback={this.fallback}>`
  ([component.ts:84](../react/src/component.ts#L84)) and reuses `fallback` as the
  error placeholder ([:169](../react/src/component.ts#L169)). So a page (`as`) is
  its own Component with its own loading fallback - **page-level loading already
  works**; Route does not implement it.
- **Expressive `set` control.** `set(assign, true)` updates silently (no event);
  `set()` forces a synchronous flush/emit; `set("event")` emits a named event
  ([state.ts:266-307](../mvc/src/state.ts#L266)). This is what lets the path
  change notify *synchronously, inside* `startTransition` (see §4).
- **React** `startTransition` (deferral) + `useTransition` (the `pending` flag).

## 4. Deferred presentation (built-in default)

No-flash-on-navigate is universal and opinion-free, so it is the seam's default.

**The crux (solved):** `startTransition` only defers renders triggered
*synchronously inside its callback*. `goto` mutates `this.path` (a reactive
field); Expressive's default batched (microtask) notify would fire *after* the
callback and escape capture, so deferral would silently no-op. Fix with `set`:
update `path` **silently**, then call `this.set()` **inside** `startTransition`
so the subscriber notify (Route re-renders reading `path`) lands in-scope and
React captures it as transition work - holding the prior screen until the
suspending page resolves. No `flushSync`, no framework change.

**`pending`.** React's pending state comes from the `useTransition` *hook*, which
lives in a component, not a method. Expose `router.pending` via a hook-resident
render member on the Router feeding the field (mirror to `aria-busy`, a progress
bar, dimming the outgoing screen). Pairs with `Link.onClick`'s `pending`.

## 5. Screen transitions (subclass override)

Unopinionated; the clean primitive is the **View Transitions API**. A subclass
overrides `transition` to bracket the swap and the **consumer owns all the CSS**
(`view-transition-name`, `::view-transition-*`):

```ts
transition(commit) {
  document.startViewTransition(() => {
    startTransition(() => { commit(); this.set(); });
  });
}
```

For richer per-screen control, overridable render members on the Router (a
`Frame`/outlet member) can host enter/leave.

- **Why not JS/FLIP first:** exit animations need the *outgoing* screen to
  persist through the transition, which React doesn't do natively (it unmounts).
  View Transitions sidesteps this via a DOM snapshot. A keep-mounted/presence
  mechanism for JS-driven exit is opinionated and deferred.
- **Opt-in granularity:** per-navigation or per-route flag vs global; respect
  `prefers-reduced-motion`.

## 6. The `fallback` conflict (RESOLVED - option A)

`Component.fallback` natively means the Suspense/error placeholder. `Route
extends Component` had overridden `fallback = false` to mean the **404
else-branch** - so Route's inherited Suspense/error placeholder was permanently
`false`, and the name was unavailable for a route-level loading placeholder.

**Resolution (option A, done):** the no-match branch is now the **`default`**
prop (`<Route default as={NotFound} />`). `fallback` reverts to Component's
Suspense/error meaning, so route-level loading + per-route error UI come for
free, uniform with all Components. `default` reads as prose at the call site and
mirrors `switch`'s `default` - the branch taken when nothing else matched. It
stays an instance field (not a render-local prop) because sibling/parent
matching computeds read it off live Route instances. Renamed in lockstep:
`hasDefault`/`defaultCatches` helpers, `RouteProps.default`, and all call sites.

Rejected alternatives:
- **B** - keep `fallback`=404; add a distinct `loading` member that places its
  own boundary. More code; works *around* the inherited boundary.
- **C** - do nothing at Route. Deferred indefinitely; A was cheap enough to do.

## 7. Plan (in order)

1. **`transition(commit)` seam** on Router; `goto` routes through it; default =
   deferred presentation.
2. **`set`-based in-transition emit** (the core): silent path update +
   `this.set()` inside `startTransition`. Verify memoized computeds
   (`matched`/`match`) recompute off the new `path` when the explicit emit fires
   (not a stale cached value), and that there's no double-notify.
3. **`pending`** flag via a hook-resident `useTransition` member on Router.
4. **Verify** against page-level loading: a suspending page holds the old screen
   on in-app nav, shows its own `fallback` on cold load. Dogfood by making one
   example's `as` suspend.
5. **fallback realignment (DONE)** - §6 option A: no-match branch is now the
   `default` prop; `fallback` reverts to Component's Suspense/error meaning.

## 8. Concerns / open
- Memoized-computed recompute timing under silent-update + explicit emit (§7.2).
- Suspense **boundary placement** for any route-level case: per-route vs a shared
  boundary at the matched-content site.
- `pending` requires a render-resident member (hook), not a plain method.
- View Transitions + React commit timing (the snapshot must capture the *new*
  screen after React commits) - validate when building §5.
