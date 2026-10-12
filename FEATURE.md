# feat/cli - terminal host for expressive-mvc

Trunk for `@expressive/cli` (private, unpublished). Feature PRs target `feat/cli`; the trunk lands on `main` when release-ready. This file does not land on `main`.

## Shape

- Standalone host on core's `@expressive/mvc/jsx-runtime` - own `jsxImportSource`, own reconciler, no framework underneath.
- Components only: `JSX.IntrinsicElements` stays empty. Styling and layout go through `Block.format(text)`, which transforms a subtree's rendered string at paint time.
- Turnkey components are extensible classes: `Text`, `Panel`, `Spinner`, `Progress`. Customize by subclassing.
- Line-based layout. No flexbox, no Yoga.

## Direction: command/ink hybrid, one reconciler

Two tiers over a shared reconciler, input layer and component set:

| Tier | Covers | New infrastructure |
|---|---|---|
| Inline (default) | commander-style scripts; Ink-equivalent interactive apps | `Static` scrollback above the live frame, `waitUntilExit`, raw stdin + keypress, focus |
| Fullscreen (deferred) | blessed/ratatui-class TUIs | alternate screen, terminal size as State, resize, cell-diff painting, clipping |

Ink is inline by default, so the inline tier plus input is Ink parity. Fullscreen is the expensive tier and waits until inline plus input proves out.

## Milestones

1. **Core parity with `@expressive/dom` semantics:** `mount()` lifecycle, element-level `fallback`/`catch`, any State as an element, collections (`has`/`map`), `State.get`/`State.use` in function components, rejected recovery bubbling to the parent boundary.
2. **Inline tier:** `Static`, `waitUntilExit`, non-TTY behavior.
3. **Input:** raw stdin, keypress dispatch to a State in context, focus.
4. **Command layer (proposal):** argv parsed onto a State - fields as flags, methods as subcommands. New public surface; needs sign-off.
5. **Fullscreen tier.**

## Open questions

- **Style pipeline:** dom's `appearance.ts` is host-agnostic except for its emitter seam (`appearance-protocol.ts`, `Emit` takes a `Document`). A terminal emitter mapping color/weight/decoration/padding/border onto SGR codes and panel framing would make cli the second consumer of the engine, and the evidence for extracting it.
- **Shared JSX module:** `cli/src/element.ts` nearly duplicates dom's `vnode.ts`. Extract (with the style engine) once a second style consumer exists, not before.
- **expressive-jsx:** a compiler emitting `style(Comp, {...})` for dom's runtime does not exist yet. Today's compiler emits zero-runtime class names and CSS.

## Out of scope

Intrinsic tags, flexbox layout, publishing.
