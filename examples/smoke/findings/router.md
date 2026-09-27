# router - dom smoke findings

`@expressive/router` renders on dom through `@expressive/mvc/jsx-runtime` without changes. Routing, matching, params, query, guards/redirects, NavLinks and BrowserRouter history (`history.back`/`forward` + popstate) all work. `Link` renders a real `<a href>` with the resolved href, and on both renderers the click default is prevented (`fireEvent.click` returns false, `location` unchanged for memory routers). A meta-click is not intercepted. The one defect is deferred navigation: `pending()` does not hold the screen when a route swap suspends.

Scenario: `smoke/router.test.ts`. Hold assertions use `expect.soft`, so the rest of each story still runs after they fail.

## router/overview - react pass / dom pass
- No findings. Link hrefs, in-memory navigation (`location.pathname` stays `/`), literal-before-param ordering, `none` fallback. A meta-click is not prevented by the router.

## router/browser - react pass / dom pass
- No findings. URL/address sync, nested `none` inside `/projects`, the `.project` layout node is identical across child pages, `history.back()`/`forward()` re-render through popstate.
- [port] `Component.Node` used without importing `Component` (codemod swapped `ReactNode` into a file whose only react import was a bare `import '@expressive/react'`) - pages-dom/router/browser/App.tsx:6 - fixed: `import type { Component } from '@expressive/mvc'`.

## router/params - react pass / dom pass
- No findings. `goto({ page })` swaps the param in place with the same instance number and the same `.section` node. Re-entry remounts (instance +1).

## router/query - react pass / dom pass
- No findings. `query.set`/`delete` navigate, `router.back()` walks the query history, `location.search` is untouched.

## router/nav - react pass / dom pass
- No findings. NavLinks groups/items, and `Link` subclass `match`/`active` classes (`tab here` / `tab near`) update on navigation.

## router/wizard - react pass / dom pass
- [port] `e.target.value` / `e.target.checked` - pages-dom/router/wizard/App.tsx:126,144,173 - fixed to `(e.currentTarget as HTMLInputElement).value`.
- [type gap] dom event handler types are `GlobalEventHandlersEventMap[K]` (packages/dom/src/jsx-runtime.ts:25), so `currentTarget` is `EventTarget | null`, not the element. Every input handler needs a cast. React's `ChangeEvent<HTMLInputElement>` narrows it. This is a typing convenience gap, not a runtime one.
- [undocumented] `value` is set only as a property; React also reflects it to the `value` attribute (`<input value="Ada">` in the React trail, no attribute on dom). The same applies to the `checked` attribute (see transitions). This only matters to `[value]`/`[checked]` attribute selectors. Diff noise otherwise.

## router/guards - react pass / dom FAIL
- [bug] Deferred navigation does not hold the screen when the route swap suspends. Clicking Charter while signed in with a 600ms async guard: React keeps the Lobby until the guard admits. dom blanks the `.view` for the whole check (smoke/router.test.ts:196). When signed out, the redirect to `/login` flashes blank for a few ticks before Login appears (React shows Login within one settle). Root cause is below under "Cause A".
- [bug] A child scope renders the unvetted destination while its guarding parent is suspended. Going from Charter to Secrets (same `:doc` Route, re-guarded): React holds "Reading charter". dom shows **"Reading secrets"** during the 600ms check (smoke/router.test.ts:205), then "No such document in the vault." The guard does work, but the page shows content the guard has not admitted yet. Root cause is below under "Cause B".

## router/transitions - react pass / dom FAIL
- [bug] Deferred navigation (default `Router.navigate` → `pending`) does not hold. Clicking Paintings: the address jumps to `/paintings` at once, `.view` goes **empty** (it shows neither Foyer nor the `unlocking…` fallback) for 700ms, then Paintings appears (smoke/router.test.ts:234-235, 265-266). The page's stated story is "holds the current screen … no fallback flash", and on dom this is worse than urgent mode, which at least shows the fallback. Urgent mode (checkbox unticked) matches React exactly. `navigating`/`data-busy` is correct. Cause A.
- [undocumented] `data-*={true}` is written as `""` (React: `"true"`), and `data-*={false}` removes the attribute (React: `"false"`) - packages/dom/src/render.ts:924-945. The page's CSS uses `.bar[data-busy]` (presence), so there is no visual impact. The scenario asserts presence.
- [undocumented] The checkbox `checked` attribute is not reflected (React: `checked=""`). The property and `:checked` are correct. Diff noise for CSS that uses `:checked`.
- [port] `Component.Node` without an import - pages-dom/router/transitions/App.tsx:7 - fixed the same way as browser.

### Cause A - sibling swap under `pending` (guards, transitions)
Route siblings are separate scopes. The outgoing Route re-renders to `null` and commits. The incoming Route then suspends on a range that has no children, so nothing is retained. dom.md:184 documents the mechanism ("Retention is per scope: siblings patched before the suspending child keep their update") but not this consequence: the swap every router performs cannot hold. This defeats `Router.navigate`'s contract (packages/router/src/router.ts:167) on dom. It may be judged "semantic per dom.md:184", but no pages-dom fix exists, so the pages stay failing.

```tsx
class Nav extends State { page = 'a' }
const A = () => Nav.get().page == 'a' ? <p>A</p> : null;
const B = () => { if (Nav.get().page != 'b') return null; if (gate) throw gate; return <p>B</p>; };
class App extends Component { nav = new Nav(); fallback = <i>loading</i>; render() { return <div><A /><B /></div>; } }
pending(() => { app.nav.page = 'b'; });   // gate resolves after 50ms
// expected (React transition): "A" → "A" → "B"
// actual dom:                  "A" → ""  → "B"
```

Suspect: packages/dom/src/render.ts:630-667 (`suspend`: a passive suspend with no committed children at render.ts:635 retains nothing, and the sibling's committed patch is not rolled back or deferred), plus per-scope flushing in packages/dom/src/scheduler.ts:16,55.

### Cause B - descendant updates while its parent is suspended (guards)
The parent's passive suspension retains the parent's range, but a descendant FC subscribed to the same state is scheduled independently and patches inside that range.

```tsx
const Child = () => <p>{Nav.get().page}</p>;
const Guard = () => { if (Nav.get().page == 'b' && !done) throw gate; return <Child />; };
class App extends Component { nav = new Nav(); fallback = <i>loading</i>; render() { return <Guard />; } }
pending(() => { app.nav.page = 'b'; });
// expected: "a" → "a" → "b";  actual dom: "a" → "b" → "b"
```

Suspect: packages/dom/src/render.ts:630 `suspend` (it does not stop descendant scopes queued by the same pending work) / scheduler.ts:55 `schedule`.

## Diff hunks (`smoke/diff.sh router`)
- overview, browser, params, query, nav: identical.
- guards: an empty `.view` where React shows the held or redirected screen, and "Reading secrets" vs "Reading charter" - bug (Cause A and B).
- transitions: address `/paintings` vs `/`, and an empty `.view` vs Foyer - bug (A). `data-busy=""` vs `"true"` - undocumented. `checked` attribute missing - undocumented.
- wizard: `value` attribute missing on inputs - undocumented (attribute reflection). No behavioural diff.

## Beyond unit tests
- `@expressive/router` has no dom-rendered tests. All `packages/router/src/*.test.tsx` use `@testing-library/react`. This smoke is the only proof that Link (`<a href>`, preventDefault, modifier pass-through), NavLinks, guards, `none` and BrowserRouter popstate work on dom. It is a candidate for a router-on-dom suite.
- The `pending` sibling swap (Cause A) is not covered. `packages/dom/src/suspense.test.tsx` tests swaps within one scope (lines 180-260, 440-520: "keep siblings consistent when a transition suspends mid-list" is a single parent re-render) but not two sibling scopes where one unmatches and the other suspends.
- A descendant updating inside a suspended-in-transition parent (Cause B) is not covered.
- `data-*` boolean serialization (`true` → `""`, `false` → removed) is not asserted. render.test.tsx:53/96 only covers `false` removal and a string value.
- BrowserRouter `history.back`/`forward` driving dom re-renders is not covered anywhere on dom.
