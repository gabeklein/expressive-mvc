# instructions (b) - map-insert, ref, ref-multiple, set, set-computed, set-factory

Scenarios: `smoke/instructions-b.test.ts` - 7 tests, all pass on react and dom. `tsc -p tsconfig.dom.json` clean for these pages.

## map-insert - react pass / dom pass
- [port] `e.target.value` (React-typed target) - pages-dom/instructions/map-insert/App.tsx:60 - dom handlers get native `Event`; now `(e.currentTarget as HTMLInputElement).value`.
- [undocumented] bound `<input value>` not reflected to the `value` attribute - diff.sh: React `<input value="Eggs">`, dom `<input>` (property correct, asserted). Affects `[value]` CSS selectors / serialized HTML only. Same hunk in ref-multiple, set, set-computed; all remaining hunks are attribute-order noise.

## ref - react pass / dom pass
- [port] `import type { PointerEvent } from 'react'` - pages-dom/instructions/ref/App.tsx:5 (removed; native `PointerEvent`), `e.currentTarget.setPointerCapture` needs a cast at :26 - native `currentTarget` is `EventTarget | null`.
- [harness] happy-dom has no layout - scenario stubs surface/box `getBoundingClientRect`, `offsetWidth/Height`, `setPointerCapture`. Drag, clamp, rounding, `box dragging` class toggle all match.
- Ref attach/detach (extra test, inline component on both renderers): `ref(cb)` fires on attach, its release runs with `null` when the node unmounts conditionally and on root unmount, re-attaches on remount; plain `ref()` `.current` is the node, `null` after unmount. Identical log on both.

## ref-multiple - react pass / dom pass
- [port] factory handler typed `(event: Event & { currentTarget: HTMLInputElement })` and read `event.target.valueAsNumber` - pages-dom/instructions/ref-multiple/App.tsx:39-40 - narrowed param fails assignability when spread onto `<input>` (TS2322 at :75); now `(event: Event)` + cast. Removed stray `import type { ChangeEvent } from 'react'`.

## set - react pass / dom pass (after fix)
- [semantic] rejected write (`throw false` on >12 chars) left `Ada Lovelace!` in the field; React reverts to `Ada Lovelace` - skills/dom/dom.md:36 ("A handler that rejects input without changing state leaves the typed value until the next render - set `event.currentTarget.value` to revert"). Fixed pages-dom/instructions/set/App.tsx:47-51: write, then `input.value = this.name`.
- [port] `e.target.value` - set/App.tsx:56, as map-insert.
- Debounce (cleanup-cancelled timer, 500ms) matches on both with real waits.

## set-computed - react pass / dom pass
- [port] `+e.target.value` x3 - pages-dom/instructions/set-computed/App.tsx:45,54,64.
- number/range `onInput` recompute of chained `set(self => …)` + shared `money()` derivation identical.

## set-factory - react pass / dom pass (after fix)
- [port] `import { Suspense } from 'react'` - dom threw `Cannot render Symbol(react.suspense).` (packages/dom/src/render.ts:219). Replaced with `<Provider for={{}} fallback={…}>` - pages-dom/instructions/set-factory/App.tsx:5,21.
- [type gap] `Provider.Props` requires `for` (packages/dom/src/context.ts:26-29) but dom.md:170 presents `Provider fallback={...}` as the explicit boundary, and runtime accepts a missing `for` (`Context.set` spreads `undefined` to an empty map). Boundary-only use needs `for={{}}` to type-check. Verified the `for={{}}` Provider shows its fallback when the child has `fallback = false` (throwaway probe, removed).
- [page, not dom] React spec never shows "loading profile…": `Profile` is a Component, so it supplies its own boundary (`fallback` default `null`, packages/react/src/component.ts:123) that catches `user`'s suspension before the outer `Suspense`. dom behaves the same (render.ts:284). The page copy ("the boundary above decides what waiting looks like") is contradicted by its own runtime - `pages/` fix would be `fallback = false` on Profile or moving the fallback onto it. Scenario asserts the React behavior.
- Sync factory `greeting` cascading off pending `user`, and `set(async, false)` reading `undefined` then updating, match on both. Trails identical.

## Type ergonomics (all pages)
- Native handler events type `currentTarget` as `EventTarget | null` (packages/dom/src/jsx-runtime.ts:25-29), so every bound input needs `as HTMLInputElement`. React narrows `currentTarget` to the element. Not a regression in runtime; a porting cost worth a typing pass (`Event & { currentTarget: T }` per element).

## Beyond unit tests
- MVC `ref()` instruction as a JSX ref (callable `ref.Object` with attach callback + release-on-null, conditional detach and re-attach) - dom tests only use plain functions / `{ current }` objects (render.test.tsx:18-19, 289). Candidate.
- Rejected state write + `currentTarget.value` revert pattern for a bound input - documented, not exercised in render.test.tsx.
- Provider as a boundary without a meaningful `for` (`for={{}}` or omitted) - suspense.test.tsx always passes a State.
- Component-owned boundary (default `fallback` null) shadowing an outer Provider fallback for the Component's own render suspension - parity with React, no dedicated test found.
- `value` attribute non-reflection vs React - no test pins either behavior.
