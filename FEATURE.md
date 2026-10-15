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
| Fullscreen (deferred) | blessed/ratatui-class TUIs | alternate screen, terminal size as a Model, resize, cell-diff painting, clipping |

Ink is inline by default, so the inline tier plus input is Ink parity. Fullscreen is the expensive tier and waits until inline plus input proves out.

## Milestones

1. **Core parity with `@expressive/dom` semantics:** `mount()` lifecycle, element-level `fallback`/`catch`, any Model as an element, collections (`has`/`map`), `Model.get`/`Model.use` in function components, rejected recovery bubbling to the parent boundary.
2. **Inline tier:** `Static`, `waitUntilExit`, non-TTY behavior.
3. **Input:** raw stdin, keypress dispatch to a Model in context, focus.
4. **Command layer (proposal):** argv parsed onto a Model - fields as flags, methods as subcommands. New public surface; needs sign-off.
5. **Terminal style emitter (experiment):** port `Text`/`Panel` to dom's style engine through a workspace import - no change to dom's exports. Tests whether the engine carries to a non-CSS host before any extraction.
6. **Fullscreen tier.**

## Long term: host-agnostic JSX

Deferred. Extract the shared JSX layer (vnode, style engine, `_attr` typing, and the label-to-`style()` transform as a subpath) into `@expressive/jsx` once the transform ships - published, host-agnostic surface with two hosts behind it. Until then cli imports dom's engine through the workspace.

Constraints for that work, so it does not harden the one-host assumption:

- **Host-free element creation.** A shared vnode is the element; `host()` only picks the default engine.
- **Emitter resolved per root or through Context**, not a module global. Enables a per-subtree interpreter, e.g. an email Model emitting inline declarations under a restricted macro set.
- **`Component.Node` tolerates more than one host**, e.g. a union of registered hosts' node types, with JSX still typed per file through `@jsxImportSource`.

These make several roots under different hosts in one process (a CLI plus a companion app sharing Models) nearly free. Mixed trees with class-declared host boundaries stay opt-in and later: subtree contents are checkable only at runtime, since TypeScript types every JSX expression by the file's namespace.

## Out of scope

Intrinsic tags, flexbox layout, publishing.
