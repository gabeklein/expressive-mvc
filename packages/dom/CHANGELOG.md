# @expressive/dom

## 0.2.0

### Minor Changes

- [#412](https://github.com/gabeklein/expressive-mvc/pull/412) [`a450c4f`](https://github.com/gabeklein/expressive-mvc/commit/a450c4f494b4fef28821c8d6382c5532886a8716) Add `@expressive/dom/vite`, a dev-server plugin for hot reload: editing a `State` or `Component` class patches it in place, keeping instance state, including its subcomponents and `style()` maps; editing a top-level function component re-renders it in place with its `State.use()` instances kept. In the `ssr` environment the injected code carries no browser-only code and leaves a replaced class to the host (`hot.replaced` on `@expressive/mvc/runtime`).

### Patch Changes

- [#420](https://github.com/gabeklein/expressive-mvc/pull/420) [`b9ad926`](https://github.com/gabeklein/expressive-mvc/commit/b9ad926b45b69495f93d4ad165f963ae34f4b0e7) Published declarations now type the `css` pack's `mx`, `my`, `px`, `py` and `size` macros. The 0.1.0 declarations dropped them, so a style map using one failed to type-check outside the repo.
- Updated dependencies [[`a450c4f`](https://github.com/gabeklein/expressive-mvc/commit/a450c4f494b4fef28821c8d6382c5532886a8716), [`66abbfb`](https://github.com/gabeklein/expressive-mvc/commit/66abbfbc6034af1be394aabc82f4bb3f9989a855), [`724b803`](https://github.com/gabeklein/expressive-mvc/commit/724b80351261a899f57f1ee2d9b1a67f16f07d0e)]:
  - @expressive/mvc@0.87.0

## 0.1.0

### Minor Changes

- [#364](https://github.com/gabeklein/expressive-mvc/pull/364) [`4fb9f19`](https://github.com/gabeklein/expressive-mvc/commit/4fb9f197009b7f01025c6f7fbf97b497e928a78c) Compose conditional class tokens and inline declarations through recursive `style` arrays. Strings now become classes, objects merge left-to-right, `class` combines with composed classes on elements, and a component's `style` forwards to its host root - overriding the root's own style, outermost caller last - unless the component reads it while rendering. A reading component receives a frozen object of the caller's declarations, with classes carried hidden through spreads, plucks and merges. The React-specific `className` alias is removed.

- [#346](https://github.com/gabeklein/expressive-mvc/pull/346) [`dbe6749`](https://github.com/gabeklein/expressive-mvc/commit/dbe674955c51aa30521417c03ed68f455407e1b4) Add an MVC-native client DOM renderer with function and class components, context, native events, keyed reconciliation, direct reactive collections, portals, lazy components, error/suspense boundaries, and committed-content retention while `pending()` work suspends.

- [#365](https://github.com/gabeklein/expressive-mvc/pull/365) [`ebe0be9`](https://github.com/gabeklein/expressive-mvc/commit/ebe0be9db5af63031e1647878c8929d1f8f92c5e) Register component and global style maps. A `_name` entry is a rule, applied by a truthy `_name` attribute or a matching host tag and emitted as one class named after its source; nested inside a rule it opens a descendant scope. Component names never match. Bare keys are declarations or macro calls, and those at the top of a map form a base rule applied to each of the component's host roots. Macros are defined only by `macro()` and layer: a key resolves at its topmost definition, and one returning its own name falls to the next definition down, then through any `'*'` handler. Unhandled keys reach the host terminal, which joins arrays and rejects functions and objects. Caller rules travel as tokens through `style` and outrank the callee's by the number of component doors crossed, independent of emission order.

- [#397](https://github.com/gabeklein/expressive-mvc/pull/397) [`569a64c`](https://github.com/gabeklein/expressive-mvc/commit/569a64c7623d576b8fa43538db791acb9ccc8fea) Type the style vocabulary. `style()` and `macro()` take typed maps rather than `Record<string, unknown>`: a bare key must be a CSS property or a macro declared in `macro.Registry`, `_name` opens a rule, and a bare key never takes an object - the distinction the grammar rests on is now enforced by the checker instead of a runtime throw. CSS property names come from `CSSStyleDeclaration` minus the CSSOM's own members, so `style={{ length: 3 }}` no longer type-checks.

  Types hang off the functions as merged namespaces - `style.Map`, `style.Value`, `style.Property`, `macro.Registry`, `macro.Map`, `macro.Fn` - so there are no new top-level exports. A macro pack augments `macro.Registry` to declare what it registers; declared names are checked at registration as well as at call sites. An empty registry remains fully usable.

- [#399](https://github.com/gabeklein/expressive-mvc/pull/399) [`f8e0012`](https://github.com/gabeklein/expressive-mvc/commit/f8e0012d21dbfbb8b0cc20cd5799cf792b6f91f5) Ship `css`, a web macro pack. `macro(css)` opts into pixel units for numbers and the axis shorthands CSS does not provide - `mx`, `my`, `px`, `py` and `size`.

  Units come from the CSSOM rather than a hardcoded list: a property is probed once with a canonical value and the answer cached, so `zIndex`, `lineHeight` and `fontWeight` keep bare numbers while lengths and logical properties get `px`, including every entry of a sequence (`margin: [1, 2]` is `1px 2px`). The terminal itself still never guesses - without the pack a rule needs `padding: '8px'`.

  The pack is deliberately small. CSS already has shorthands, and arrays plus units cover them; only the axis pairs, which CSS lacks entirely, and `size` earn a macro.

### Patch Changes

- Updated dependencies [[`522606a`](https://github.com/gabeklein/expressive-mvc/commit/522606a7c64453cc38ebdcceab4c741a63c2a6b3), [`2d9f0aa`](https://github.com/gabeklein/expressive-mvc/commit/2d9f0aad304397024ae7879b7126e26d0a93afe6), [`451911b`](https://github.com/gabeklein/expressive-mvc/commit/451911bcf19a1117cf0bd399669a7e1af6b60129), [`99dc2e9`](https://github.com/gabeklein/expressive-mvc/commit/99dc2e9bb182dbde2ac043ff645419cfe72530d9), [`3ce41fb`](https://github.com/gabeklein/expressive-mvc/commit/3ce41fbf5c24434dd7c44484593a4ee766a221ae)]:
  - @expressive/mvc@0.86.0
