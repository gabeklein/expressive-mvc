# @expressive/dom - pre-release fix list

From the examples smoke audit ([AUDIT.md](AUDIT.md)) against `origin/main` @ `522606a7c`. Every renderer bug below was reproduced twice: in the page scenario, and again in a minimal throwaway test in `packages/dom` (repros inline). Ranked by user impact.

## Blockers - renderer bugs

### 1. Owned collections crash when rendered from a tracked read
`<ul>{this.items}</ul>` with `items = has(...)` / `map(...)` throws on mount (`Cannot read properties of undefined (reading 'length')`, `values is not iterable`, `Map.prototype.entries called on incompatible receiver`). Only untracked collections work, and they are the only case the unit tests cover (`render.test.tsx:759`). This breaks the documented idiom for owned lists (examples guide: "`has()`, never a plain array").

```tsx
class A extends Component {
  items = has(['x', 'y']);
  render() { return <ul>{this.items}</ul>; }
}
render(<A />, root); // expected 'xy', throws
```

- Cause: `mountCollection` (`packages/dom/src/render.ts:338-349`) passes the tracking view to `watch()`, which wraps it again. `source()` in `has.ts:296` / `map.ts:242` unwraps only one level. React unwraps the entire prototype chain first (`packages/react/src/has.ts:8-15`).
- Pages: instructions/has, instructions/map, featured/kanban (the whole page fails to render).

### 2. Component instances from a tracked read remount on every parent render
Each parent re-render rebuilds every child instance's DOM. A keyed reorder creates new nodes where it should move the existing ones. As a result focus, selection, in-flight drag and CSS transitions are lost, and the extra work costs performance.

```tsx
class Item extends Component { name = ''; render() { return <li>{this.name}</li>; } }
class Items extends Component {
  items = has(Item); tick = 0;
  protected new() { this.items.add({ name: 'a' }); this.items.add({ name: 'b' }); }
  render() { const { tick } = this; return <ul data-tick={tick}>{[...this.items]}</ul>; }
}
// app.tick++  -> both <li> replaced (expected: kept)
```

- Cause: the root cause is the same as #1. `touch()` returns a fresh `Object.create` view per read (`packages/mvc/src/observable.ts:105`), and dom matches fibers by `fiber.instance === value` (`render.ts:296`, `render.ts:815`). Unwrap to the underlying instance before storing and comparing. #1 and #2 are probably one helper used in both places.
- Pages: featured/kanban.

### 3. `pending()` blanks the screen when a sibling scope suspends
When a transition unmatches one sibling scope and the incoming sibling suspends, the outgoing sibling commits `null` and the incoming one has nothing to retain. The view goes empty and shows no fallback either, which is worse than urgent mode. This defeats `Router.navigate`'s deferred default (`packages/router/src/router.ts:167`), because every route swap has this shape.

```tsx
class Nav extends State { page = 'a' }
const A = () => Nav.get().page == 'a' ? <p>A</p> : null;
const B = () => { if (Nav.get().page != 'b') return null; if (!done) throw gate; return <p>B</p>; };
class App extends Component { nav = new Nav(); fallback = <i>loading</i>; render() { return <div><A /><B /></div>; } }
pending(() => { app.nav.page = 'b'; });
// expected A -> A -> B; observed A -> '' -> B
```

- `skills/dom/dom.md` ("Retention is per scope") describes the mechanism but not this consequence. Treat it as a bug unless you decide deferred route swaps should not hold. If so, the router docs and the transitions example need rewriting.
- Suspect: `render.ts:630-667` (`suspend`: passive suspend with no committed children retains nothing, the sibling's patch is not deferred) and per-scope flushing in `scheduler.ts:16,55`.
- Pages: router/transitions, router/guards.

### 4. `pending()` renders a descendant inside a suspended parent
While a parent is suspended in a transition, a descendant subscribed to the same state patches independently. On router/guards the unvetted destination ("Reading secrets") shows for the whole async guard check. That leaks content past a guard.

```tsx
const Child = () => <p>{Nav.get().page}</p>;
const Guard = () => { if (Nav.get().page == 'b' && !done) throw gate; return <Child />; };
pending(() => { app.nav.page = 'b'; });
// expected a -> a -> b; observed a -> b -> b
```

- Suspect: `render.ts:630` `suspend` does not stop descendant scopes queued by the same pending work, and `scheduler.ts:55`.
- Pages: router/guards.

### 5. camelCase props on SVG are written as attributes verbatim
`<svg tabIndex={0}>` produces the attribute `tabIndex="0"`, so the element isn't focusable (`svg.tabIndex === -1`). dom's types accept the prop. The keyboard story on component/custom breaks. The SVG branch at `render.ts:939-945` skips property assignment. Assign the property when `key in element`, or map the name to its attribute.

## Should fix or document - behavior differences

6. **`autoFocus` is ignored.** It's written as an attribute, and browsers honor a dynamically inserted `autofocus` at most once per document. React focuses on mount. Either focus on insert (React parity), or document it and reject it in types. It's already rejected in types, so document the `ref={(el) => el?.focus()}` replacement. Pages: kanban, spreadsheet.
7. **Boundary escalation race.** A `catch()` that writes render state and then rejects: the reset render can reveal the content while the outer boundary's `catch()` is still pending. The result depends on microtask order (`render.ts:680-689`). Decide the semantics and pin them with a test. Page: component/boundary.
8. **Controlled `value` / `checked` are properties only.** React also writes them as attributes, and as the textarea's text content. Consequence: `form.reset()` resets to empty on dom but to the last rendered value on React, and `[value=…]` / `[checked]` selectors differ. Document it (dom.md:36 implies it without saying so), or reflect `defaultValue`.
9. **`data-*` booleans.** `true` becomes `""` and `false` removes the attribute; React writes `"true"`/`"false"`. `[data-x="true"]` selectors break silently. Also, when the property is missing, enumerated attributes (`draggable`, `spellcheck`, `contenteditable`) get `""` from `true`. Match React or document it.
10. **Nested boundary under an outer reveal.** The inner fallback survives the outer boundary's reveal (content stays off-document) where React rebuilds. This is intended per dom.md:170, but that the inner state persists deserves one sentence in the docs.
11. **Caught errors aren't logged.** React `console.error`s each boundary-caught error; dom is silent. Document it; the `Caught`/`State.on({ catch })` path already exists for anyone who wants logging.
12. **React-cased event names that don't lowercase to a native name** (`onDoubleClick` → listens for `doubleclick`, which never fires). Types reject it, so the risk is untyped spreads. One line in dom.md ("native names: `onDblClick`").

## Type gaps

13. **`Node` doesn't accept `has`/`map` collections** (`packages/dom/src/vnode.ts:12`), though the runtime renders them. Fix alongside #1.
14. **Event handlers don't narrow `currentTarget`** (`jsx-runtime.ts:24-30`, `GlobalEventHandlersEventMap[K]`). dom.md's own idiom `event.currentTarget.value` fails `tsc`, so every bound input needs a cast. `Event & { currentTarget: T }` per element would fix it.
15. **`Provider` requires `for`** (`context.ts:26-29`), but dom.md documents `Provider fallback={…}` as the explicit boundary, and the runtime accepts it without `for`.

## Example page bugs (React baseline, not dom)

16. **instructions/set-factory** never shows its "loading profile…" fallback. `Profile` is a Component, so its own default boundary catches the suspension first. The page copy says otherwise. Fix: `fallback = false` on Profile.
17. **component/injection** never marks the active panel `primary`. `panel === active` compares two tracking views, and they're never identical. It's the same identity instability behind #2, visible here on React. Fix the page to compare `.is`. Also consider whether mvc should make views identity-stable per scope, which would fix #1, #2 and #17 in one place.

## Candidates for permanent validation

Behavior the scenarios exercised that no `packages/dom` or `packages/router` test covers. In priority order:

- Router on dom: every `packages/router` test uses `@testing-library/react`. The smoke is the only evidence that Link, NavLinks, guards, `none` and BrowserRouter popstate work on dom. This is the strongest case for a permanent suite.
- Collections and Component instances rendered from tracked reads, kept across re-render and reorder (#1, #2).
- `pending()` across sibling scopes and descendants (#3, #4).
- SVG camelCase properties (#5).
- MVC `ref()` instruction as a JSX ref (attach, release on conditional unmount, re-attach).
- Lifecycle order: mount `new()` → ref attach → `mount()`; unmount ref detach → `mount()` cleanup → `new()` cleanup.
- Sibling render isolation across components; `static global` updated from window events; `get(X, true, filter)` downstream through Provider.

## Appendix - port friction (not regressions)

What the codemod and agents had to change in `pages-dom`. This is useful migration-guide material:
- `className` → `class`; the text-field `onChange` → `onInput` (both documented).
- `e.target.value` → `(e.currentTarget as HTMLInputElement).value` (#14).
- React generic event types (`PointerEvent<T>`) → native; `e.dataTransfer!`.
- `Suspense` → `Provider for={{}} fallback`.
- camelCase SVG presentation attributes (`strokeDasharray`) → kebab-case.
- A rejected state write needs a manual `currentTarget.value` revert (documented).
- `import State from` default → named `{ State }`; `ReactNode` → `Component.Node`.
