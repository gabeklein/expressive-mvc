# @expressive/dom

## 0.3.0

### Minor Changes

- [#453](https://github.com/gabeklein/expressive-mvc/pull/453) [`a34a9e9`](https://github.com/gabeklein/expressive-mvc/commit/a34a9e9b78496c023d290460fc9e2c560eac2e13) `createElement(type, props, ...children)` and `Fragment` are exported from `@expressive/dom` for classic JSX and code built without JSX. Point `jsxFactory`/`jsxFragmentFactory` at them, or use `import * as React from '@expressive/dom'` with tool defaults. Attributes are typed as with the automatic runtime; the root also exports the `JSX` namespace type, so `React.JSX` resolves under tool defaults. `Fragment` also works by name for keyed fragments, `<Fragment key={id}>`.

- [#454](https://github.com/gabeklein/expressive-mvc/pull/454) [`0863b57`](https://github.com/gabeklein/expressive-mvc/commit/0863b572541950346ec90e439d25c6bb3a402f35) `lazy` is removed. A function component that returns a promise of a component, or of a module with a `default` component, now renders as that component, so `const Settings = () => import('./Settings')` replaces `lazy(() => import('./Settings'))`. It suspends until the promise settles. The result is kept per function, so later renders and other placements render the loaded component without calling it again. A failed load reaches the nearest `catch`, and the render after recovery loads again. A loader takes no parameters. JSX types the element's attributes from the loaded component, including a State or Component class, and a Route's `as` accepts a loader.

- [#451](https://github.com/gabeklein/expressive-mvc/pull/451) [`3d1eb4d`](https://github.com/gabeklein/expressive-mvc/commit/3d1eb4dd34e828992ecfa58f3b4d46d19c2d60c3) `createPortal(children, container, key?)` is replaced by a `Portal` element: `<Portal into={container} key={…}>{children}</Portal>`. `into` also takes a selector string, resolved when the portal mounts; it throws unless exactly one element matches. The context, ownership and suspense behaviour are unchanged. There's no alias.

- [#440](https://github.com/gabeklein/expressive-mvc/pull/440) [`92b8c43`](https://github.com/gabeklein/expressive-mvc/commit/92b8c433aa5adb0172eea6b504c8ebb120e96629) PascalCase methods are no longer rewritten into subcomponents. A PascalCase method of any State or Component becomes a subcomponent when rendered as an element (`<this.Label />`, or passed on and rendered elsewhere). It tracks its owner wherever it renders, and keeps its state across a hot patch or a `set()` override. Called directly, it stays a plain method. A PascalCase function field is plain data and renders as an ordinary function component.

- [#431](https://github.com/gabeklein/expressive-mvc/pull/431) [`d816f89`](https://github.com/gabeklein/expressive-mvc/commit/d816f896d9a89060aca394ec1d41f6bcf11010a2) A State element owns a boundary from `fallback` or `catch` attributes as well as members: `<Page fallback={<Spinner />} catch={(error, page) => …} />`. An attribute takes precedence and still passes through to a field of that name. `State.Props` types both, narrowed to a declared member's type. Function components and placed instances are unchanged. `@expressive/react` honors a `catch` attribute on a Component the same way, ahead of the member, and `Component.Props` types it. Every `catch`, member or attribute, now receives `(error, instance)`.

- [#429](https://github.com/gabeklein/expressive-mvc/pull/429) [`ff619a9`](https://github.com/gabeklein/expressive-mvc/commit/ff619a9d78dca36c336f153cea006a7ca8aef0a4) Any `State` class renders as an element in `@expressive/dom`. With `render(props)` it produces content like a Component - attributes assign fields, `is`, `mount()` and destruction on unmount apply - and without one it passes children through. Either way the instance is provided to its subtree, so `<Session>…</Session>` replaces `<Provider for={Session}>`. A State element owns a suspense boundary only when it declares `fallback` or `catch`. dom's `JSX` types class element attributes from the instance: `props` when declared, else `State.Props` (an augmentation dom adds) derived from fields, `is` and `render`.

- [#450](https://github.com/gabeklein/expressive-mvc/pull/450) [`2413220`](https://github.com/gabeklein/expressive-mvc/commit/24132202b13fc05c518af7e7e62b4383e0cef3f8) `Provider` is deprecated in `@expressive/react` and removed from `@expressive/dom`. Use `<Component for={…}>` from `@expressive/mvc`, which provides one State per element; compose a parent State in place of `for={{ … }}`. `Consumer` is removed from both: read with `X.get()` in a function component.

- [#430](https://github.com/gabeklein/expressive-mvc/pull/430) [`3390c35`](https://github.com/gabeklein/expressive-mvc/commit/3390c35059ee5290fb4c1a050b2bfd1fd0305065) `@expressive/mvc/jsx-runtime` exports `compose`, which renders `this` through its class's render layers composed up the prototype chain, so a State's render layers compose as a Component's do.

### Patch Changes

- [#441](https://github.com/gabeklein/expressive-mvc/pull/441) [`397c212`](https://github.com/gabeklein/expressive-mvc/commit/397c212d7df9b23b9fe153ce76fb5ad7ce9543bc) **Breaking:** `@expressive/mvc/runtime` is removed. Host seams (`host`, `HostRuntime`, `Host`, `childrenOf`, `isElement`, `typeOf`, `propsOf`) move to `@expressive/mvc/jsx-runtime` beside the transform contract (`jsx`, `jsxs`, `jsxDEV`, `Fragment`, `JSX`); class HMR moves to its own subpath, `@expressive/mvc/hot`, exporting `accept` and `replaced`.

  - Host seam imports from `@expressive/mvc/runtime` → `@expressive/mvc/jsx-runtime`.
  - `import { hot } from '@expressive/mvc/runtime'` → `import * as hot from '@expressive/mvc/hot'`.
  - `declare module '@expressive/mvc/runtime'` augmentations of `Host` → `declare module '@expressive/mvc/jsx-runtime'`.

  Adapters, router, inspect, and the Vite plugins import the new path.

- Updated dependencies [[`f6d9d81`](https://github.com/gabeklein/expressive-mvc/commit/f6d9d81951916e216c5ded575a93eb8c11389a5e), [`29d1a48`](https://github.com/gabeklein/expressive-mvc/commit/29d1a481d4d58a85c46bf67ac2656f61bef95061), [`d816f89`](https://github.com/gabeklein/expressive-mvc/commit/d816f896d9a89060aca394ec1d41f6bcf11010a2), [`f6d9d81`](https://github.com/gabeklein/expressive-mvc/commit/f6d9d81951916e216c5ded575a93eb8c11389a5e), [`0863b57`](https://github.com/gabeklein/expressive-mvc/commit/0863b572541950346ec90e439d25c6bb3a402f35), [`397c212`](https://github.com/gabeklein/expressive-mvc/commit/397c212d7df9b23b9fe153ce76fb5ad7ce9543bc), [`8debf28`](https://github.com/gabeklein/expressive-mvc/commit/8debf286a6d2d0abdec0b3d315868ab9b5d41bc5), [`6b6498c`](https://github.com/gabeklein/expressive-mvc/commit/6b6498c334402e17a89951f4b82a8a689e361dc4), [`3390c35`](https://github.com/gabeklein/expressive-mvc/commit/3390c35059ee5290fb4c1a050b2bfd1fd0305065)]:
  - @expressive/mvc@0.88.0

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
