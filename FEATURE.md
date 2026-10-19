# feat/ui

Trunk for `@expressive/ui` (`packages/ui`) - headless, host-agnostic components. Lands on `main` once release-ready. This file does not land.

Origin: a spike that harvested candidates from `gabeklein/LFCP` (`app/src/common`, `app/src/lib`) and ported survivors to current mvc. The LFCP originals are in `spike/ui-package` under `packages/ui/reference/` - consult there, not here.

## Shape

- One package; zero runtime dependencies beyond `@expressive/mvc`.
- A module with an irreducible third-party dependency ships standalone, not in `ui`.
- Open: subpath exports per module (currently `.` only); whether `form/` graduates to `@expressive/form` once validation/schema adapters give it its own dependency weight and release cadence.
- Private (`changeset` ignored) until the public surface is agreed - publishing is new public surface and needs sign-off.

## Status

Caught up to `main` (extends `Model`). `tsc` clean, `tsdown` builds, every module tested, coverage at the 100% gate. Tests run under happy-dom (`suite(true)`) for `overlay`, `sentinel` and `keyboard`.

## Scope

| Module | Verdict | Notes |
|---|---|---|
| `form/` | **keep** | From closed PR #198. Ownership model open (`has(Input)` pool vs downstream discovery). |
| `table/` | **keep** | `Grid` + `Column`. Flagship - the abstract-slots pattern LFCP arrived at independently. |
| `action/` | **keep** | Async gate. Replaces three separate `useState` reimplementations. |
| `list/` | **keep** | `Source` (paged) + `sentinel` (DOM-only trigger). |
| `overlay/` | **keep, blocked** | Dismissal, escape and open-count are agnostic; portalling is not. See seams. |
| `calendar/` | **keep** | `date-fns` replaced by `src/calendar/date.ts` (~70 lines native `Date`, incl. `addMonths` short-month clamping). |
| Masked input | **standalone** | `imask` is parsing infrastructure. Own package or consumer's problem. |
| SelectInput | **cut** | `react-select` wrapper. The real answer is a headless combobox. |
| Dropzone | **cut for now** | `react-dropzone` wrapper; underlying logic is ~30 lines, could return with upload. |
| Switch, Progress, Spinner/Hold, Empty, Section, Flex, Info, InputLike, Container, Page, NavHeader, Logo, format | **cut** | Set dressing. |
| `lib/{database,firebase,orm,storage,csv,states,select}`, PersonInfo, FileForm | **cut** | App-specific. |
| `lib/url.tsx` (`download`, `openInTab`) | **cut** | DOM utilities, not components. |

## Seams

1. **`Type.get()` is unavailable to agnostic code.** The static consumer is declared by the adapter (`packages/react/src/state.get.ts`), not core - hook-shaped capabilities stay out of `runtime.ts`. `Grid` builds header and rows inline off `this`, so a data change re-renders the whole grid rather than one row. A larger constraint on an agnostic library than #128.
2. **Intrinsics are not the problem.** `Grid` renders only its four slots plus `Fragment` - no host tag manifest needed. Slot-shaped components sidestep #128; it binds on leaf components that emit a tag (router's `Link`, a canonical text/box).
3. **No portal seam.** `Overlay` has dismissal, escape and cross-instance open count, but `createPortal` has no agnostic equivalent - a host subclass must own render. Blocks Dialog/Popover/Tooltip/Menu.
4. **`Component.key` is reserved** for collection identity, colliding with a table row-key function. Renamed `rowKey`.
5. **LFCP's `get(this, fn)` computeds port to getters**, not zero-arg `set()` factories - those run once and are read-only. `Calendar.backMonth`/`nextMonth` return `false` at a bound.
6. **Generic `Component` subclasses trip `Component.Props` in JSX.** `<Column<Row> />`, or `<Column />` once `CellProps<Row>` has resolved in the same file, fails with TS2615 (circular mapped type over `set`/`props`). Core typing issue in mvc; `grid.test.tsx` types `Column` through a props-only alias.

## Not supplied by LFCP

New work, designed fresh:

- Positioning - anchor rects, flipping, collision. The expensive half of overlay.
- Combobox/autocomplete, tabs, toast queue, tree, sortable/reorder, virtualization.
