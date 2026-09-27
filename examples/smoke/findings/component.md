# component - findings

Run: `vitest run -c smoke/vitest.config.ts smoke/component` - react 13/13, dom 11/13. `tsc -p tsconfig.dom.json`: clean for `pages-dom/component/**`.

## props - react pass / dom pass
No findings. Parent preset reapplies CPU; same-preset click doesn't re-render the parent, so a bump holds; Disk keeps its `is`-seeded value. Diff: none.

## subcomponents - react pass / dom pass
- [noise] `class=""` for unselected `<li>`: React writes an empty attribute, dom removes it - smoke/out/*/component_subcomponents_* - no CSS here depends on `[class]`.

## injection - react pass / dom pass
- [page, both renderers] Draft/Review never get `primary` - pages/component/injection/App.tsx:39 `panel === active` compares two tracking proxies. `touch()` hands back a fresh `Object.create(child)` on every read (packages/mvc/src/observable.ts:105, :131), so identity never matches. The scenario asserts what React actually shows (smoke/component.test.ts:110). Not a dom regression; the spec page needs a fix, e.g. comparing `.is`.
- [port] `e.target.value` on a native event is `EventTarget` - pages-dom/component/injection/App.tsx:72 - changed to `(e.currentTarget as HTMLTextAreaElement).value`.
- [noise] React mirrors the textarea value into its text node; dom sets only the `.value` property. `.value` is asserted equal on both.

## headless - react pass / dom pass
No findings. The 100ms and 1000ms tickers run independently. Unmount clears both intervals on both renderers.

## lifecycle - react pass / dom pass
Ordering is the same on both. Mount: `new()` → `ref() attached` → `mount()`. Unmount: `ref() detached` → `mount() cleanup` → `new() cleanup` (destroy). This is not a strict reverse - React detaches the ref before the effect cleanup, and dom matches. The resize listener is live while mounted and removed after unmount. A remount starts a fresh instance (`alive 0s`). Diff: none.

## suspense - react pass / dom pass
No findings. Greeter shows its own fallback until 900ms. Reader (`fallback={false}`) is covered by Panel until 1400ms. Card headers stay visible throughout. "Ask again" re-keys both and re-suspends. Diff: none.

## boundary - react pass / dom 2/3
- [undocumented] React logs each error a boundary catches through `console.error` ("The above error occurred…"): 1 for Recoverable, 2 for the escalated error. dom logs nothing. The scenario asserts per-renderer counts through `drain()` (`logged(n)`, smoke/component.test.ts).
- [undocumented, borderline bug] The escalation is undone within a tick - pages-dom/component/boundary/App.tsx:106 (spec at pages/component/boundary/App.tsx:105). `Escalating.catch` sets `broken = false` and then rejects. The MVC dispatch of that write is queued first, so dom's order is:
  1. The rejection handler escalates, `wait()`s on Boundary, and Boundary's fallback shows.
  2. The render queued by `broken = false` succeeds, `unwait()` runs, and the content comes back while `Boundary.catch` is still pending.
  "Start over" never appears to stay (MutationObserver trail: fallback, then content again).
  - Per dom.md:170 ("reveals at once when every waiting scope renders") and :186, a pending `catch()` does not hold a fallback. That rule isn't stated for escalation, though, and the result depends on microtask order: had the render flushed before the rejection, the fallback would have held.
  - Suspect code: render.ts:680-689. The `recover` rejection branch re-waits the fiber without checking that it has since rendered cleanly, and nothing lets the handling boundary's pending promise hold the reveal.
  - Fix in pages-dom: the reset render lands before declining (`this.broken = false; await new Promise((settled) => setTimeout(settled)); throw error;`). The fiber is healthy when it escalates, Boundary holds until Start over, and the retry reveals.
- [semantic] After the outer fallback, "Start over" leaves the first card in its own fallback on dom. React rebuilds the subtree to "Break it" - dom.md:170 "its content stays mounted off-document". Test `will rebuild an inner fallback under an outer one` (smoke/component.test.ts:325) stays failing on dom. The divergence is intended. No page-level fix fits without adding a render/key to Boundary, which the page says it deliberately lacks. The page copy doesn't promise a rebuild, so this is a user-visible difference, not a regression in the story.

## custom - react pass / dom 2/3
- [bug] `tabIndex` on an SVG element is written as an attribute named `tabIndex`, not `tabindex`. The arc is then not focusable in a real browser, which kills the keyboard story ("focus it and use the arrow keys"). Types accept it because `tabIndex` is an `SVGElement` property. Test `will render the arc as an accessible SVG slider` fails on dom at smoke/component.test.ts:354. Repro:
  ```tsx
  render(<svg tabIndex={0} />, root);
  root.querySelector('svg')!.getAttribute('tabindex'); // expected '0', actual null (attribute 'tabIndex')
  root.querySelector('svg')!.tabIndex;                 // expected 0, actual -1
  ```
  Suspect: packages/dom/src/render.ts:939-945. For `namespaceURI === SVG` it skips property assignment and calls `setAttribute(key)` with the prop name as-is. It needs to either assign the property when `key in element` (tabIndex) or map the name to its attribute.
- [port] `strokeDasharray` (React camelCase) was reaching the DOM as the invalid attribute `strokeDasharray`, so the filled arc had no dash. dom types reject it (TS2322). Changed to `stroke-dasharray` - pages-dom/component/custom/Arc.tsx:84. Codemod gap: camelCase SVG presentation attributes.
- [port] React generic event types `PointerEvent<SVGSVGElement>` / `KeyboardEvent<SVGSVGElement>` became native `PointerEvent` / `KeyboardEvent` with `(e.currentTarget as Element)` - Arc.tsx:33-51. `e.target.valueAsNumber` became `(e.currentTarget as HTMLInputElement).valueAsNumber` - App.tsx:69, :83.
- [type gap, minor] dom's handler events keep `currentTarget: EventTarget | null` rather than narrowing to the host element, so every port needs a cast. packages/dom/src/jsx-runtime.ts:24-31.
- [undocumented/noise] Controlled `<input value>`: React mirrors `value` to the attribute, dom sets only the property - diff shows `value="14"` missing on dom. `.value` is equal on both. Only an `input[value=…]` selector would notice.
- [noise] Attribute order (`class` last on dom) throughout.
- [harness] No layout in happy-dom - `getBoundingClientRect` is stubbed on the svg. Pointer capture never auto-releases on pointerup. Keyboard, both inputs, clamping, rounding, pointer aim, the below-pivot pin, and no drag without capture all match on both.

## Beyond unit tests
- SVG `tabIndex` → `tabindex`: packages/dom/src/render.test.tsx covers `tabIndex` only on HTML (:42, :114); the SVG tests (:368, :704) use lowercase attributes only. The SVG camelCase-property path is uncovered.
- Escalation from a `catch()` that writes render state before rejecting, while the outer boundary's `catch()` is pending. suspense.test.tsx:701 covers escalation only with a static rejection and a synchronous outer catch. Neither the race nor whether a pending outer `catch()` holds is covered.
- Nested boundaries where the inner one is in fallback when the outer one hides and reveals: inner state survives on dom, the React divergence. No test pins it.
- Unmount order `ref detached → mount cleanup → new cleanup` matches React; worth pinning as a lifecycle-order test in packages/dom.
