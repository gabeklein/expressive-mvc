# Examples: visual system + educational ladder

Branch basis: `feature/router` — groups, the Route-based `Examples.tsx` harness, and the
`1-simple/` / `2-advanced/` reorganization are prerequisites, not things to rebuild here.

Mission: each example is both a lesson and a flex. The App.tsx is the artifact people
read — the product is "look how little code this is" (tic-tac-toe and forms set the bar).
The examples app doubles as a live-demo vehicle and must become more self-service.

## Decisions

- **No Tailwind.** Styling lives in per-example CSS files plus a shared token sheet, so
  the JSX stays pristine and styling never competes with the MVC code for attention.
  Also keeps generated sandboxes free of build config. No expressive-jsx either, until
  it is well-supported enough to not be a gotcha.
- **Shared theme via `theme.css`.** One token sheet (colors, spacing, type scale,
  radii, dark mode via `prefers-color-scheme`) consumed by the dev harness *and*
  injected by the website loader into every generated sandbox. Distribution, not
  aesthetics, is the architectural piece: today `_base` styles never reach sandboxes.
- **Shared components via `common/`.** Examples import generic chrome (e.g. `Panel`,
  `Button`) from a `@common` alias:
  - *Dev:* Vite alias resolves to `examples/common/`, normal HMR.
  - *Website:* the loader scans example sources for `@common/...` imports, includes the
    transitive closure of those files in the sandbox file map under `/common/...`,
    rewrites specifiers to relative paths (tsconfig paths are unreliable in the
    `react-ts` Sandpack template), and marks them `hidden: true` — invisible as tabs,
    present on eject to CodeSandbox.
  - *Hard rule:* anything pedagogically interesting stays in the example. `common/` is
    presentational chrome only, kept flat and dependency-light so the closure stays
    trivial. If a hidden file holds the impressive part, the example lies.
- **Self-service chrome.** Frame header per example: title, one-paragraph "what this
  teaches", link to open in sandbox / view source. Metadata via a `meta` export from
  each `App.tsx` (or sibling `meta.ts`) — the loader and harness both read it.

## Table of contents (draft — for review)

Numbered prefixes define order; slugs drop them. Group 1 is the narrative ladder:
strictly one new concept per step. Later groups carry the "impress" mandate and may
overlap concepts with the ladder — different jobs.

### 1. Crash course (`1-course/`)

1. **counter** — `State` class, `.use()`, assignment-is-update. *(exists)*
2. **computed** — getters as derived state; re-render only on what you read.
3. **lifecycle** — `protected new()` + cleanup, timers. *(exists as `2-async`; refit)*
4. **context** — `get()` + `Provider`; per-component subscription granularity. *(exists)*
5. **components** — `Component` class: props-as-state, `render`, subcomponents.
6. **refs** — `ref()` two-way binding on inputs (minimal form, not the full Form class).
7. **async** — promise-backed values / suspense (`set` with promise, fallback).

### 2. Patterns (`2-patterns/`)

1. **fetch** — Query base class: abstract `request()`, waiting/response/error. *(exists)*
2. **forms** — Form base class, typed inputs, live preview. *(exists)*
3. **undo** — history/snapshot pattern (cheap with class state; impressive payoff).

### 3. Apps (`3-apps/`)

1. **tictactoe** — game logic, win detection, `hot()` arrays. *(exists)*
2. **todo** — `List`: models within arrays, the canonical ask (issue #51).
   *(gated on `feature/list`)*
3. **stopwatch** or **pomodoro** — timers + derived display; small but visually rich.

### 4. Router (`4-router/`) *(gated on `feature/router` shipping)*

1. **navigation** — `BrowserRouter`, `Route`, `Link` basics.
2. **nested** — route trees, `Layout`/`Label`, groups.
3. **transitions** — deferred presentation, pending flags.
   *(gated on `feature/router-transition`)*

Cut candidates if the ladder feels long: `computed` can fold into `counter`;
`stopwatch` is optional polish.

## Sequence

1. ~~Base branch on `feature/router`~~ + this doc. *(done)*
2. **TOC review** — settle the list above before styling work scales to it.
3. **Visual system** — `theme.css` tokens; loader injection so sandboxes inherit the
   theme; `common/` alias + hidden-file plumbing in `loader.ts`; frame-header chrome
   (title / description / open-in-sandbox).
4. **Restyle the existing six** onto the new system.
5. **New examples** per approved TOC, each landing already in the visual language.
   Router/list groups land as their feature branches ship.
