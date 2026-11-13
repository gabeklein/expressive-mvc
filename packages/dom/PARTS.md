# Parts: style across component boundaries (proposal)

Scope and shape for `__` part selectors in `@expressive/dom`. Proposal for sign-off - nothing is built; this file is dropped before the branch merges.

## Problem

A `style()` map styles only elements its own component's JSX writes. A `_rule` on a child component element reaches the child's root, and goes deeper only when the child reads its `style` prop and places it itself. A caller cannot aim at an element inside a child it does not own - a UI library Select's `<input>`, its menu options, a calendar's day cells - short of replacing pieces or subclassing.

## Grammar

`__` keys, beside the existing two sigils:

| Sigil | Meaning | Crosses component boundaries |
|---|---|---|
| `_name` | lexical rule: a flag or tag in this component's own JSX | no |
| `$name` | pack condition or variable | n/a |
| `__name` | **part**: an element marked `__name`, or a `name` tag element, anywhere below | yes |

An element marks itself public with the attribute; any ancestor's map styles it:

```tsx
// a library's skin marks its leaves
const Input = () => <input __input {...Select.get().inputProps} />;
const Option = ({ option }) => <div __option aria-selected={…}>{option.label}</div>;

// an app styles them from outside
style(Page, {
  __input: { borderRadius: 6, ':is([aria-invalid="true"])': { borderColor: '#fcc0c0' } },
  _year: { flex: 1, __control: { textAlign: 'center' } },   // only inside <Select _year />
  $mobile: { __input: { padding: 4 } },
  __a: { color: 'green' }                                    // every link below Page
});

// app-wide through the pack
export const style = App.use({ __day: { borderRadius: '50%' } });
```

`__name` bodies take declarations, macros, `:`/`@` conditions and nested parts (`__menu: { __option: … }`). A `_` key inside a part body throws: lexical names mean nothing inside another component's output.

## Semantics (recommended answers)

1. **Depth: arbitrary.** A part rule reaches marked elements anywhere in the declaring component's rendered subtree, at any component depth - the point is "any owned child to catch", and the library author opts in by marking. Precision comes from nesting under a flag (`_year: { __control }` reaches only parts inside that child). One-component-deep would need `exportparts`-style re-exporting and boundary tracking in the selector; not worth it for v1.
2. **Tags: yes, as weak defaults.** `__a` also matches `<a>` elements below, consistent with `_name` matching a flag or a tag. The difference is precedence: a **marked** element was opted into outside styling by its author, so the part rule beats that author's own styles (as CSS `::part` does); an **unmarked** tag element was not, so the tag match is a default that the element's own component overrides. This falls out of the selectors (below) - a tag match has type-selector specificity and loses to any class rule.
3. **Nearest ancestor wins** between two ancestors styling the same part (a Page's `__input` over the pack's), via CSS `@scope` proximity; then nested-under-flag over top-level.
4. **State through attributes.** A part rule cannot name the owner's private flags (`_active`); libraries expose state as `aria-*`/`data-*`, and part bodies use `':is([aria-selected="true"])'`.
5. **Portals.** A portal's DOM sits outside its owner's, so descendant selectors miss it - a Select menu portalled to `<body>` would escape `Page`'s `__option`. Portal roots carry the anchor classes of their logical owner chain (claimed like any element), so scoped part rules follow MVC ownership across the jump.

## Mechanics

Fits the existing claim/emit machinery; no runtime matching.

- **Marking.** `__name` on an element adds a stable class `__name` (readable in devtools) and is otherwise style-only, never reaching the DOM as an attribute - like `_`. Today `__name` parses as a lexical rule named `_name`; `createStyleScope`, `createAppearanceRoute` and `unmatched` branch on `__` first. Nothing in the repo uses `__` keys or attributes.
- **Anchor.** A component whose map holds part rules gives its host roots an anchor class (its scope label), the same way base declarations reach roots; a nested part rule anchors on the flag's class (`Page_year`).
- **Emission.** A part rule becomes a `Block` emitted as `@scope (.Page) { .__input:where(…) {…} }` for a marked part and `@scope (.Page) { a:where(…) {…} }` for a tag; pack-level part rules emit unscoped at pack ordinal. Conditions reuse the existing `when` handling (`:` states, `@` wrappers). Marked parts go in a band after all lexical rules so equal-specificity order also favors them.
- **Specificity summary.** Marked part `(0,1,0)` + later band + nearest scope → beats the owner's single-class rules; tag match `(0,0,1)` → loses to any class; inline `style` still beats both.

## Typing

An augmentable `interface Parts {}` in `@expressive/dom`. A library declares its names (`declare module '@expressive/dom' { interface Parts { input: true; option: true } }`); maps type `__` keys as `` `__${keyof Parts | keyof HTMLElementTagNameMap}` ``, so `__inptu` fails in TypeScript, and JSX accepts `__${keyof Parts}` attributes. The current `` `_${string}` `` attribute type would otherwise also admit `__x`; it narrows to exclude a second underscore.

## Diagnostics

- An unmarked element never warns - parts are opt-in hooks.
- A part rule matching nothing cannot be known cheaply at runtime (matching is CSS); the `Parts` type is the typo guard. No runtime warning in v1.
- `_` inside a part body, and `__Name` with a capital, throw at `style()` (the latter reads as a subcomponent).

## Use in @expressive/ui

Each control marks its leaves (`__input`, `__control`, `__menu`, `__option`, `__chip`, `__day`, `__prompt`) and exposes state through ARIA. Apps restyle internals - including portalled menus - without replacing pieces, which pairs with the proposed `Element`/`Container` split there. Marks are plain props, so a host-agnostic base can write them; hosts other than dom ignore them.

## Public surface (for sign-off)

- `__name` keys in `style()` / `use()` maps and `__name` attributes on host elements.
- `interface Parts` (augmentable type).
- Behavior: portal roots carry their owner chain's anchor classes.

## Cost and risks

- Bundle: a `__` branch in three functions, anchor classes, one emission path - small; measure with the size harness when built.
- `@scope` support: Chrome 118+, Safari 17.4+; confirm Firefox's shipping version before relying on proximity. Fallback without `@scope`: `:where(.Page) .__input` (order instead of proximity for ancestor ties).
- happy-dom does not implement the cascade faithfully; verify with `bun .github/scripts/cascade-probe.ts` in real Chrome (proximity, part-over-owner, tag-under-owner, portal anchors).
- A part name shared by two libraries is one name - intended (`Parts` merges them), but a theme rule hits both.
