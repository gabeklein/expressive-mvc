# featured

Scenarios: `smoke/featured.test.ts`. Final run: react 5/5, dom 4/5 (kanban fails on a renderer bug).

## forms - react pass / dom pass

Covered: ref-bound inputs get `name` from key, typing updates the `<pre>` preview per field, empty submit alerts, filled submit alerts full message, clearing a field.
- No findings. Ref callbacks + native `input` listeners behave the same.

## spreadsheet - react pass / dom pass (after fix)

Covered: header/rows, click-to-edit, focus on the editor, typing, Enter/Escape/blur commit, formula `=A1*2+C1` recompute and cascade (`B2 = B1/2`), text cells, `#ERR`, text refs count as 0, re-open shows raw input.
- [undocumented] `autoFocus` not honored - dom sets it as an attribute (`autoFocus in input` is false, so `render.ts:939-944` falls to `setAttribute`). No focus on insert. React focuses on mount. Browsers honor dynamically inserted `autofocus` at most once per document, so this breaks in real browsers too. `skills/dom/dom.md` says nothing. Fix: `ref={(el) => el?.focus()}` - `pages-dom/featured/spreadsheet/App.tsx:108`.
- [port] `e.target.value` fails typing (native `Event`) - `spreadsheet/App.tsx:110` -> `(e.currentTarget as HTMLInputElement).value`.
- [type gap] handler `currentTarget` typed `EventTarget | null` although at runtime it is always the bound element - `packages/dom/src/jsx-runtime.ts:25-29` (`GlobalEventHandlersEventMap[K]` with no element narrowing). Every text-input handler in the group needs a cast.
- diff: `<input value="5">` (react) vs `<input>` (dom) - dom sets only the `value` property, React also reflects it to the attribute. [undocumented] only matters for `input[value=...]` CSS/attribute selectors; `dom.md:36` covers property sync and doesn't mention the attribute.

## tictactoe - react pass / dom pass

Covered: turn alternation, occupied-cell no-op, win on the top row (`X wins!`, `board done`, `wins` on 3 cells), post-win no-op, New game reset, full-board draw, reset after draw.
- diff: noise only - React keeps `class=" "` / `class="X "`, dom tokenizes (`render.ts:1046`) and drops the empty attribute. Class token sets are identical (checked with whitespace normalized).

## stopwatch - react pass / dom pass

Covered (real 10ms interval, short real waits): initial `00:00.00` + Reset disabled, Start -> `Stop` label + `running` class + Reset enabled, time advances, Stop freezes, resume advances, Reset zeroes, disables and stays at zero. The page has no lap control, so the brief's "lap" doesn't apply.
- diff: noise only - `class="time "` vs `class="time"` (tokenized), plus timer jitter (`00:00.07` vs `.08`).

## kanban - react pass / dom FAIL (bug)

Covered: 4 columns + `--accent`, seeded cards and counts, `draggable`, add via form submit (draft clears, blank ignored), drag reorder within a column (`dragging`/`over` classes, DOM node identity kept), drag to column end (`over-end`), drag before a card in another column, insert between cards, double-click rename (focus, not draggable while editing, Enter commits), Escape cancels, blur with blank keeps title, delete.

- [bug] Rendering a `has` collection read through a Component's render proxy throws on mount: `TypeError: values is not iterable` (`has.Pool`) / `Cannot read properties of undefined (reading 'length')` (`has.List`). The page's `<div class="board">{this.columns}</div>` (`kanban/App.tsx:78`) takes down the whole page. Suspect: `packages/dom/src/render.ts:338-348` `mountCollection` watches the tracking view as given. `watch()` wraps it again (`Object.create(view)`), and `has.ts:296` `source()` unwraps only one prototype level, so `MEMBERS` misses. React unwraps the whole prototype chain first (`packages/react/src/has.ts:8-15`). Repro:
  ```tsx
  class Item extends Component { name = ''; render() { return <li>{this.name}</li>; } }
  class Items extends Component {
    items = has(Item);
    protected new() { this.items.add({ name: 'a' }); }
    render() { return <ul>{this.items}</ul>; }   // same with has<string>(['a'])
  }
  render(<Items />, el); // expected <ul><li>a</li></ul>; actual TypeError
  ```
- [bug] Component instances read through a tracked scope get remounted on every parent re-render: a new `<li>` each time, even when order doesn't change. Keyed reorder doesn't move nodes. Mid-drag, the dragged node is replaced (the page's own comment warns a moved node may not fire `dragend`). The rest of the scenario passed with `{[...this.columns]}` swapped in (reverted). The node-identity asserts (`featured.test.ts` "reorder within a column") failed, and so did the stale `retire`/`shipped` class asserts. Suspect: tracked reads return a fresh `observe()` view per read (`mvc/src/observable.ts:105`, via `touch` line 129). dom stores that view as `fiber.instance` (`render.ts:296`) and matches by `fiber.instance === value` (`render.ts:815`), so a later render's new view never matches. Repro:
  ```tsx
  class Item extends Component { name = ''; order = 0; render() { return <li>{this.name}</li>; } }
  class Items extends Component {
    items = has(Item); tick = 0;
    protected new() { this.items.add({ name: 'a', order: 1 }); this.items.add({ name: 'b', order: 2 }); }
    render() { const { tick } = this; return <ul data-tick={tick}>{[...this.items].sort((x, y) => x.order - y.order)}</ul>; }
  }
  // app.tick++  -> expected both <li> nodes kept; actual both replaced
  // b.order = 0 -> expected nodes moved (b2, a2); actual new nodes
  ```
- [port] `onDoubleClick` never fires - dom lowercases to a `doubleclick` listener (`render.ts:906`), and the native event is `dblclick`. Fix: `onDblClick` - `kanban/App.tsx:151`. (The type rejection is already known; its runtime effect is a dead rename.)
- [undocumented] `autoFocus` on the rename input, same as spreadsheet - `kanban/App.tsx:141` -> `ref={(el) => el?.focus()}`. Verified: focus lands on the input with the workaround.
- [port] `e.dataTransfer` possibly null (native `DragEvent`) - `kanban/App.tsx:122,137,201` -> `!`.
- [port] `e.target.value` / `e.currentTarget.value` - `kanban/App.tsx:143,145,215` -> cast (see the spreadsheet type gap).
- [harness] happy-dom has no `HTMLElement.draggable` property, so dom falls back to `setAttribute('draggable', '')` for `true` and removes it for `false`. React writes `"true"`/`"false"`. In a browser the property path would reflect `"true"`/`"false"`. The scenario asserts on "present and not `false`". The fallback itself (`render.ts:944`, `true -> ''`) is wrong for enumerated attributes (`draggable`, `spellcheck`, `contenteditable`) anywhere the property is missing. Low risk in browsers.
- [type, known] `{this.columns}` rejected as `Node` - `kanban/App.tsx:78` (only remaining tsc error in the group).
- diff (from the workaround run): attribute order (noise), `draggable` `true`/`""` (harness, above), `<input value="">` attribute (as in spreadsheet). The committed dom trail stops at the mount crash.

## tsc (`tsconfig.dom.json`)

Group is clean except the known `has` children error at `kanban/App.tsx:78`.

## Beyond unit tests

- `has.List`/`has.Pool` rendered from inside a Component/FC render scope (tracked view). `render.test.tsx:759` "will render MVC collections directly" only renders module-scope, untracked collections.
- Component instances as keyed children from a tracked read, kept across parent re-render and reorder. `render.test.tsx:736` "will retain keyed DOM ranges while reordering" covers only `<li key>` vnodes.
- `autoFocus` (no test; not polyfilled) and `onDoubleClick` -> `doubleclick` mapping (no test for event-name mapping of React-cased names).
- Boolean `true` on a missing-property enumerated attribute (`draggable`) serializes to `""`. `render.test.tsx:226` covers removal, not enumerated true/false.
