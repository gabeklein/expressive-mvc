# essentials

Scenarios: `smoke/essentials.test.ts` - 8 tests, pass on react and dom. `fetch` stubbed via `vi.stubGlobal` with deferred responses; async timer via `vi.useFakeTimers({ toFake: ['setInterval','clearInterval'] })` and `Math.random` spy, identical on both projects.

## counter
react pass / dom pass. Extended: button labels/classes, negative values, reset from negative, `<pre>` node identity kept across updates.
- no findings; DOM trails identical.

## async
react pass / dom pass. Countdown ticks, agent swap via stubbed fetch, both explode/spare outcomes (early-return tree swap), interval cleared at expiry and by `new()` teardown on unmount.
- no findings; DOM trails identical.

## computed
react pass / dom pass. Number + range inputs drive both getters, including getter-on-getter (`total` reads `tip`); input node identity kept.
- [undocumented] controlled `value` is property-only on dom; React also mirrors it to the `value` attribute (`<input type="number" value="120">` vs `<input type="number">`) - packages/dom/src/render.ts:879-887 - `smoke/diff.sh essentials_computed`. Visible only to `[value=...]` CSS selectors / `getAttribute`; `input.value` matches. `skills/dom/dom.md` ("`value` and `checked` ... compared with the live element") implies property semantics but does not state the attribute is not written.
- [noise] attribute order `min max type` (react) vs `type min max` (dom) in the same diff.
- [type gap] handler events are plain `GlobalEventHandlersEventMap[K]`, so `e.target`/`e.currentTarget` are `EventTarget | null` - packages/dom/src/jsx-runtime.ts:23-29 - `onInput={e => +e.target.value}` fails TS18047/TS2339. dom.md itself recommends `event.currentTarget.value`, which fails the same way. Fixed pages-dom/essentials/computed/App.tsx:33,44 with `(e.target as HTMLInputElement).value`.
- `onChange`→`onInput` already applied by port (semantic, dom.md "`onChange` on a text field fires on commit").

## fetch
react pass / dom pass. idle → waiting (button gone, status shown) → response → reset → second run; error path → reset.
- no findings; DOM trails identical.

## tsc
`tsc -p tsconfig.dom.json` clean for essentials/{counter,async,computed,fetch} after the computed cast.

## Beyond unit tests
- `value` attribute not mirrored for controlled inputs - no test in packages/dom/src asserts either way (`render.test.tsx:246` covers value-after-bounds ordering only). Worth pinning whichever behavior is intended.
- `State.use()` whose `new()` returns a teardown: interval cleared on FC unmount. `adapter.test.tsx:55` covers `mount()` teardown, not `new()`'s returned cleanup under `State.use`.
- Awaited async-method writes (`this.response = await ...`, error in `catch`, `finally`) re-rendering an FC that early-returns entirely different root trees per state - no dom test drives a State.use FC through several full root swaps.
