# packages/ui spike

Scope exercise: pull every plausible candidate out of `gabeklein/LFCP` (`app/src/common`,
`app/src/lib`), port what survives to current mvc, and decide what belongs.

Originals are kept verbatim under `reference/` (excluded from tsc, vitest and the
build) as ground truth for the ports. Delete before any real PR.

**Status:** `tsc --noEmit` clean, `tsdown` builds, form's 6 tests pass. Coverage
fails the 100% gate — only `form/` has tests. Expected for a spike.

## Verdict

| Module | Verdict | Notes |
|---|---|---|
| `form/` | **keep** | From PR #198. Ownership model still open (`has(Input)` pool vs downstream discovery). |
| `table/` | **keep** | `Grid` + `Column`. Flagship — the abstract-slots pattern LFCP arrived at independently. |
| `action/` | **keep** | Async gate. Replaces three separate `useState` reimplementations. |
| `list/` | **keep** | `Source` (paged) + `sentinel` (DOM-only trigger). |
| `overlay/` | **keep, blocked** | Dismissal + escape + open-count are agnostic; portalling is not. See seams. |
| `calendar/` | **keep** | See below — the dependency dissolved. |
| Masked input | **standalone** | `imask` is genuinely irreducible. Own package or consumer's problem. |
| SelectInput | **cut** | `react-select` wrapper. The real answer is a headless combobox, which LFCP never had. |
| Dropzone | **cut for now** | `react-dropzone` wrapper; the underlying logic is ~30 lines and could return with upload. |
| Switch, Progress, Spinner/Hold, Empty, Section, Flex, Info, InputLike, Container, Page, NavHeader, Logo, format | **cut** | Set dressing. |
| `lib/{database,firebase,orm,storage,csv,states,select}`, PersonInfo, FileForm | **cut** | App-specific. |
| `lib/url.tsx` (`download`, `openInTab`) | **cut** | DOM utilities, not components. |

## Calendar: the dependency was not hard

The premise was that `date-fns` consumers ship standalone. LFCP's `Control` used
twelve helpers — `addDays/addMonths/addYears`, `startOf|endOf` `Day|Week|Month`,
`isSameDay/isSameMonth`, `setMonth/setYear`. All twelve are in `src/calendar/date.ts`
in ~70 lines of native `Date`, including `addMonths`' short-month clamping (the one
piece with a real edge case).

So calendar stays in `ui` with zero dependencies. The rule still holds — it just
doesn't bind here. It binds on masking, where `imask` is parsing infrastructure,
not convenience.

## Seams hit while porting

1. **`Type.get()` is unavailable to agnostic code.** The static consumer is declared
   by the adapter (`packages/react/src/state.get.ts`, `declare module '@expressive/mvc'`),
   not core — `runtime.ts` says so explicitly: "hook-shaped (render-resident)
   capabilities do not belong here." So `Grid.get(...)` does not typecheck in this
   package. Grid now builds header and rows inline off `this`, which **costs
   granularity**: a data change re-renders the whole grid rather than one row.
   This is a larger constraint on an agnostic component library than #128 is.

2. **Intrinsics were never the problem.** `Grid` renders only its four slots plus
   `Fragment`, so it compiles and runs with no host tag manifest at all. Slot-shaped
   components sidestep #128 entirely. #128 binds on leaf components that must emit a
   tag themselves — router's `Link`, and eventually a canonical text/box.

3. **No portal seam.** `Overlay` carries the dismissal gesture, escape handling and
   the cross-instance open count, but LFCP's `ReactDOM.createPortal` has no agnostic
   equivalent. A host subclass has to own render. This is the actual blocker on the
   Dialog/Popover/Tooltip/Menu cluster.

4. **`Component.key` is reserved.** `Component` declares `readonly key: string` for
   collection identity, which collides with a table's row-key function. Renamed to
   `rowKey`. Worth knowing before other components reach for `key`.

5. **`get(this, cb)` computeds are gone**; `set(factory)` replaces them. But a
   set-factory reads `undefined` as suspend, which collides with LFCP's idiom of
   returning `undefined` from a computed to mean "disabled". `Calendar.backMonth` /
   `nextMonth` return `false` instead. Any ported computed using absence-as-disabled
   needs this treatment.

## What LFCP does not supply

Worth stating, because it bounds how far dogfooding gets us. LFCP only ever needed
centered modals, so there is **no positioning implementation at all** — no anchor
rects, no flipping, no collision. That is the expensive half of the overlay
capability and it has to be designed fresh.

Also absent: combobox/autocomplete (delegated to `react-select`), tabs, toast queue,
tree, sortable/reorder, virtualization.

So the LFCP harvest is: form, table, calendar, async gate, paged list, and modal
dismissal. Roughly half of the ~12 targets — the other half is new work.
