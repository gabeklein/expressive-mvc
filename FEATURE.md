# feat/tui - terminal host (parked)

Agenda for a TUI built as a full JSX host on dom's renderer core. **Parked** until the dom/jsx split is decided. This file does not land on `main`.

## Prerequisite: host seam in dom

The TUI reuses dom's reconciler through a host interface; it does not get its own reconciler. Draft #542 (`refactor/dom-host-seam`) has the design but is stale - redo on current main, after #695 (`renderToString`, style emitter writing to a document or text sink) since both reshape style emission.

- `Host` = Vue-style node ops: `element`, `text`, `marker`, `fragment`, `insert`, `remove`, `parent`, `next`, `root`, `clear`, `setText`, `target`, plus `prop`, `style`, `raw`, optional `created`/`settle`/`release`/`flush`. Fibers stay marker ranges.
- DOM specifics move to `src/dom`: attributes, events, SVG, controlled-input restore, autofocus, sheet emitter, `css` pack, intrinsic types. `claim()` returns `{ block, depth }`; the host emits.
- No `deferred` member - dom applies `value`/`checked` in `settle`. Host remembers each element's last class string rather than re-emitting the previous claim.
- Published types must not move: attach DOM intrinsics and `style` typing in dom's `jsx-runtime` entry by augmenting `@expressive/mvc/jsx-runtime`. A relative `declare module '../jsx-runtime'` survives d.ts bundling unrewritten and drops every intrinsic. Keep `Portal`'s DOM target type. Diff built `.d.ts` exports against main.
- `Host`/`install` stay internal until sign-off. An `install()` at module scope needs its file in dom's `sideEffects`.
- Verify: dom suite at 100%, an in-memory host test under `@vitest-environment node`, `dist-check`, `dist-smoke`, `cascade-probe`, `hot-probe`, examples `tsc`.

## Multi-host constraints

Decide before `Host`/`Tags` go public:

- **Keyed host registry**, not one global augmentation: `interface Hosts { dom: {...}; tui: {...} }`, `Component.Node` = union of registered nodes. Same for `Tags` and `style.Property`. Today two hosts in one program fail to compile.
- **Host per root** (`render(node, container, host)`), `install()` only as default. Needed for a CLI plus companion app sharing Models in one process.
- **Style emitter per root or through Context**, so a subtree can swap interpreters (e.g. email: inline declarations, restricted macros).
- Crosstalk is user error: TS types every JSX expression by the file's namespace, so subtree contents are runtime-only. Optional later: phantom host brand on a host-exported `Component`, runtime rejection at boundaries.

## TUI shape

- Host keeps a virtual node tree; `flush()` serializes and repaints. Styles map to ANSI SGR.
- **Inline tier** (Ink parity, first): repaint below the prompt, `Static` scrollback above the live frame, `waitUntilExit`, raw stdin + keypress dispatched to a Model in context, focus. Non-TTY writes only the final frame.
- **Fullscreen tier** (later): alternate screen, terminal size as a Model, resize, cell-diff paint, clipping.
- Line-based layout. No flexbox or Yoga - instant startup is the pitch against Ink's WASM cost.
- Turnkey components as extensible classes: `Text` (color + modifiers, per line, re-open around nested closes), `Panel` (border, padding, title, escape-aware width), `Spinner` (`frames`, `interval`), `Progress`.
- Integrates with `@expressive/cli` milestone 3 renderer slots (`status`, `progress`, `message`, `children`; TTY frame vs piped; `@expressive/steps` defaults).

## Prior art: `feat/cli` (tip `253e7e91`)

Standalone renderer before the seam existed. Reuse `terminal.ts` (frame repaint, non-TTY), `ansi.ts`, `components.ts`; drop `render.ts` (own reconciler) for the dom core. Learnings that still apply:

- Call `unbind(proxy.render).call(proxy, props)` - core binds methods to the instance, so `proxy.render()` does not track.
- A `watch` inside another's callback registers with the parent effect; scope child mounts with `capture()` when the renderer owns teardown.
- Rethrow suspense as settle-only (`err.then(noop, noop)`) so destroying a suspended instance leaks no rejection.
- `this.get(Type)` in a field resolves before the instance is registered - use the `get(Type)` instruction. Same under dom.

## Open

- Package home: `@expressive/tui`, or inside `@expressive/cli` (the `cli` name now means commands).
- Whether cli milestone 3 waits for the JSX host or ships a minimal renderer first.
- Standalone `@expressive/jsx`: extract when a second published host exists, or when the label-to-`style()` transform ships (as a subpath). `feat/native-app` FEATURE.md records the NativeScript host spike.

## References

#542 host seam (draft), #695 dom server render, #689 `@expressive/cli`, `feat/native-app`, `feat/cli`.
