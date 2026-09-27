# composition - findings

Scenario: `smoke/composition.test.ts`. Re-render claims are checked by spying `State.get` (static) per class after mount: each call is one render of the FC/scope calling it. Factory calls (`Consumer`) are keyed apart. Both projects pass: 10/10.

## composition/nested
react: pass / dom: pass
- [port] `e.target.value` on native `Event` does not type-check - pages-dom/composition/nested/App.tsx:133 - changed to `(e.currentTarget as HTMLTextAreaElement).value`. See the type gap under concerns.
- [undocumented] dom sets textarea `value` only as a property. React also writes it as text content (default value), so the trail shows `<textarea>hello</textarea>` on react and `<textarea></textarea>` on dom. No visible effect; `form.reset()` would differ (React resets to the last rendered value, dom to empty). - packages/dom/src/render.ts:100 (`CONTROLS`), :884 - diff.sh hunks `-hello`, `-hello world`, `-draft text here`.
- Verified on both: `get(Doc)`/`get(History)` in grandchildren (Undo, Words, Sheet, through the FC Toolbar) resolve owned `new Doc()` children of Editor. `has()` `.size` drives `disabled` and the label. Close destroys both, and reopening gives an empty sheet, "0 words" and a disabled `Undo `.

## composition/context
react: pass / dom: pass
- Verified on both: `Provider for={{ shop, cart }}` map, `Cart.get()` lookup from FCs, `Consumer for={Cart}` total. Render counts per add: `Shop` 0 (Greeting does not re-render), no-arg `Cart.get` exactly 1 (Badge only; Shelf's `is` read does not subscribe). The same holds over two more adds (0 / 2).
- No diff hunks.

## composition/concerns
react: pass / dom: pass
- [port] `e.target.value` - pages-dom/composition/concerns/App.tsx:87 - changed to `(e.currentTarget as HTMLInputElement).value`.
- [type gap] dom event props are typed `(event: GlobalEventHandlersEventMap[K]) => unknown` (packages/dom/src/jsx-runtime.ts:25-29), so `currentTarget` and `target` are `EventTarget | null`. Every bound text field needs a cast. React's `ChangeEvent<HTMLInputElement>` narrows it. The runtime is correct; only the type is element-agnostic. Same cast at extension/App.tsx:81 and nested/App.tsx:133.
- [undocumented] `<input value>` is set as a property with no `value` attribute - trail `-<input … value="anal">` / `+<input …>`. The same property-vs-attribute behavior as nested. It matters only to `[value=…]` attribute selectors. dom.md ("`value` and `checked` apply after children…") does not say they are property-only.
- Verified on both: three sibling `get()` consumers (Filters, Results, Detail) of three owned states. Tag `class` toggles, search filtering, empty state `li.empty`, and the selection survive filter changes.

## composition/extension
react: pass / dom: pass
- [port] `e.target.value` - pages-dom/composition/extension/App.tsx:81 - cast as above.
- [noise] Attribute order: react `class="head" aria-expanded`, dom `aria-expanded class="head"` (dom applies `class` after other props). There are 20 hunks, all attribute order only.
- [undocumented] The textarea value property-vs-content hunk (`-remember me`) is the same as nested.
- Verified on both: the base `Panel.render` wraps the subclass render as `props.children`. `aria-expanded`/`–`/`+` toggle per instance. Collapsing unmounts `.body`, and reopening Notes restores the `text` field, since the state belongs to the instance and not the DOM. The tally keeps counting while Notes is collapsed.

## composition/globals
react: pass / dom: pass
- The resize is driven by `happyDOM.setViewport({ width })` plus a dispatched `resize`. Verified on both: 480 gives "480px" / "compact layout", and 900 gives "wide layout". Per resize: `Viewport` 1 render, `Session` 0, `Theme` 0 ("resize the window and just the first one moves" holds). Log in/out re-renders only Session, and Switch only Theme. `documentElement.dataset.theme` follows the toggle, from `Theme.new()`'s effect.
- [harness] The module-scope `.new()` singletons persist for the life of the worker. The scenario restores `innerWidth` at the end, and a second test would inherit the Session/Theme state.
- No diff hunks.

## tsc
`tsc -p tsconfig.dom.json` is clean for composition after the three casts.

## Beyond unit tests
Nothing in `packages/dom/src/*.test.*` covers these:
- A Component subclass render composed inside the base class's render as `props.children` (extension). No dom test has a Component subclass of a Component subclass.
- The `get(Type)` field instruction on Components resolving an ancestor's owned `new X()` children through an intermediate FC. Also teardown of the owned children on unmount and fresh ones on remount (nested). No `= get(` appears in dom tests.
- `static global` + `.new()` reached by `.get()` with no Provider, updated from a window event (globals). No dom test uses `static global`.
- Sibling isolation, where a write re-renders only the sibling reading the changed field and not the siblings reading other fields or classes. adapter.test.tsx:11 counts renders only within one component.
- `Provider for={{ a: Class, b: Class }}` map with `Consumer` re-rendering on a tracked field. adapter.test.tsx:327 checks map ownership, not updates.
- The textarea/input `value` property-vs-attribute behavior. No dom test asserts it.
