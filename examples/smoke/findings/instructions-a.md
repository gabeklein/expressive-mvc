# instructions (a) - def, get, get-downstream, has, has-list, map

Scenarios: `smoke/instructions-a.test.ts`. Run: 10 pass, 2 fail (both dom, same bug).

## instructions/def - react pass / dom pass
- [harness] happy-dom `HTMLLabelElement.dispatchEvent` forwards every click inside a `<label>` to its first labelable descendant, including clicks on interactive content (spec: no activation) - `node_modules/happy-dom/lib/nodes/html-label-element/HTMLLabelElement.js:79-92`. The stepper buttons sit inside a `<label>`, so "+3" also clicked "−3": React stuck at 3, dom at 0 (different orders - React's root delegation runs after the label forwards, dom's target listener runs before). Not a regression. The test patches label activation to spec for its duration (`labelActivationPerSpec`, top of test file).
- [port] `onInput={(e) => (this.handle = e.target.value)}` - React-typed idiom; `e.target` is `EventTarget | null` on a native event - `pages-dom/instructions/def/App.tsx:57`. Changed to `(e.currentTarget as HTMLInputElement).value`. Same fix at `get/App.tsx:71`, `get-downstream/App.tsx:71`, `has/App.tsx:54`, `has-list/App.tsx:56`.
- [type gap] dom event props are typed `(event: GlobalEventHandlersEventMap[K]) => unknown` - `currentTarget` is not narrowed to the host element, so the idiom `skills/dom/dom.md:36` recommends (`event.currentTarget.value`) needs a cast - `packages/dom/src/jsx-runtime.ts:24-30`.
- [undocumented] dom sets `value` as a property only; React also mirrors it to the `value` attribute. Every input diff hunk in this group is `<input ... value="x">` (react) vs `<input ...>` (dom). Visible value is identical; only `input[value=...]` CSS selectors would differ. `render.ts:879-886` (CONTROLS). dom.md:36 describes live-property comparison but not the missing attribute. No page here relies on it.
- diff: only the `value` attribute hunks above.

## instructions/get - react pass / dom pass
- Upstream `get(Form, false)` through a `Component` + FC (`Group`) children, lock toggles `disabled`/`placeholder` on in-form fields only, standalone field unaffected - identical.
- [port] `e.target.value` (see def).
- diff: only `value` attribute hunks.

## instructions/get-downstream - react pass / dom pass
- `get(Candidate, true, vet)` through dom `Provider`: roster counts arrivals/departures, write-ins render but never count, removing the chosen candidate clears the choice - identical.
- [port] `e.target.value` (see def).
- diff: only `value` attribute hunks.

## instructions/has - react pass / dom FAIL
- [bug] A collection field read through a component's tracking proxy crashes on mount: `TypeError: values is not iterable` (`packages/mvc/src/field/has.ts:274`, from `render.ts:361`). Cause: `mountCollection` passes the value it was handed - `observe()`'s `Object.create(pool)` proxy - straight to `watch()`, which hands its callback another `Object.create` layer. `source()` (`has.ts:296`, `map.ts:242`) unwraps one prototype level only, so `MEMBERS`/`Map.prototype.entries` get a proxy. React unwraps to the raw collection first (`packages/react/src/has.ts:10-15`, `map.ts`); dom does not - suspect `packages/dom/src/render.ts:338-349` (`fiber.release = watch(value, ...)` at 347). Repro (fails on dom; verified in a throwaway test):
  ```tsx
  class A extends Component {
    items = has(['x', 'y']);
    render() { return <ul>{this.items}</ul>; }
  }
  render(<A />, root);
  // expected root.textContent 'xy'; actual: TypeError (Cannot read 'length' / values is not iterable)
  ```
  Same with `const { items } = S.get()` in an FC. Standalone `new has.List()` (the only case `render.test.tsx:758` covers) works. Scenario left failing on dom; no dom trail beyond the failed mount.
- [known] `{todos}` rejected by dom `Node` type - `has/App.tsx:59` (TS2322). Left as-is.
- [port] `e.target.value` (see def).

## instructions/has-list - react pass / dom pass
- Renders `[...history].map(...)` (spread), so it avoids the collection bug. push/pop, `get(-1)`, `size`, `disabled={!history.size}` identical.
- [port] `e.target.value` (see def).
- diff: only `value` attribute hunks.

## instructions/map - react pass / dom FAIL
- [bug] Same root cause as has, `map.Managed` flavor: `TypeError: Method Map.prototype.entries called on incompatible receiver #<Managed>` - `packages/mvc/src/field/map.ts:134`, from `render.ts:361`. Repro: `class A extends Component { items = map<string, string>(); new() { this.items.set('a', 'A'); } render() { return <ul>{this.items}</ul>; } }` - expected `'A'`, actual throw. Scenario left failing on dom.
- [known] `{people}` rejected by dom `Node` type - `map/App.tsx:35` (TS2322).

## tsc (`tsconfig.dom.json`, group files)
Clean except the two known collection-as-child `Node` errors (`has/App.tsx:59`, `map/App.tsx:35`).

## Beyond unit tests
- Rendering an owned collection field (`has(...)`, `has(Class)`, `map(...)`) read through a Component's `this` or `State.get()` - the everyday case - is untested; `render.test.tsx:758` only renders standalone collections. It is broken (bug above).
- Downstream `get(X, true, filter)` resolving through dom `Provider`/Component context, tracking mount/unmount of keyed children - no dom test (`get(... true)` does not appear in `packages/dom/src/*.test.*`).
- A `def` setter that rewrites an input's value during its own `onInput` (slug) - the live-value compare must patch the element in the same commit. `render.test.tsx:264` covers restore on an unrelated re-render only.
- `disabled` flipping via `form?.locked` (false -> true -> false) and `placeholder` swaps on an input whose value is user-typed - value survives the patch. Not covered directly.
