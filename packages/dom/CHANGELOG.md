# @expressive/dom

## 0.10.1

### Patch Changes

- [#648](https://github.com/gabeklein/expressive-mvc/pull/648) [`ac9785c`](https://github.com/gabeklein/expressive-mvc/commit/ac9785cb36540a46c41c9a90ecf0b5adcb715edb) Importing `@expressive/dom` no longer fails to typecheck with circular-type errors in the style macros (`'css' implicitly has type 'any'`, `Type 'Registry' recursively references itself`) in projects that compile its source.

## 0.10.0

### Minor Changes

- [#621](https://github.com/gabeklein/expressive-mvc/pull/621) [`fbd4d44`](https://github.com/gabeklein/expressive-mvc/commit/fbd4d44f0f0f53090e3e1ba333b446a2c155b8ac) `Css` gains macros for properties where px is wrong: `transitionDuration`, `transitionDelay`, `animationDuration` and `animationDelay` take numbers as milliseconds, and `rotate` takes degrees. The `rem`, `em`, `px` and `media` exports are removed - write other units as strings, and conditions on a `$name` field (`$mobile = '@media (max-width: 900px)'`).

- [#629](https://github.com/gabeklein/expressive-mvc/pull/629) [`e38c545`](https://github.com/gabeklein/expressive-mvc/commit/e38c545abbaee0f4f42057c999f9c0e2f7800b3d) Warn in development when a `_name` attribute matches no rule, suggesting the nearest rule name. A `$name` condition written as a value now throws.

- [#623](https://github.com/gabeklein/expressive-mvc/pull/623) [`0d67321`](https://github.com/gabeklein/expressive-mvc/commit/0d673219351d46ba227255e82339bc8ad4943c99) `Css` gains `transition`, which takes an object keyed by property (`{ opacity: 200, transform: { duration: 300, easing: 'ease-out' } }`) with times in milliseconds, and `offsetRotate`, which takes degrees. Maps accept a number only for properties where one is valid CSS, so `color: 5`, `animation: ['spin', 1]` or `flex: [1, 1, 200]` is a type error; a map for a pack without `default`, plain `style()` included, accepts only unitless numbers and `0`.

- [#617](https://github.com/gabeklein/expressive-mvc/pull/617) [`da139b2`](https://github.com/gabeklein/expressive-mvc/commit/da139b26a8fce30ac9d7b32230d8393dc4946c41) A `Style` pack names conditions with `$name` fields (`$mobile = '@media (max-width: 900px)'`), used as `$mobile: { … }` keys in any map styled by that pack and overridable by a subclass. The fallback method for keys no macro handles is renamed from `'*'` to `default`.

- [#618](https://github.com/gabeklein/expressive-mvc/pull/618) [`ce992da`](https://github.com/gabeklein/expressive-mvc/commit/ce992da672180115caef810025e548fac3626db8) `App.use(...maps)` takes pack rules - element defaults, roles and condition blocks applied to elements written by every component that `style` styles, below each component's own declarations and rules. Each call with maps is its own scope; `use()` without maps stays shared per class. `style(X)` with no map joins the pack, and subcomponents without a map receive its rules. The conflict error now reads `is already styled by another pack`.

### Patch Changes

- [#633](https://github.com/gabeklein/expressive-mvc/pull/633) [`283bafe`](https://github.com/gabeklein/expressive-mvc/commit/283bafe8ca164c5555f34b1896aae252bbd336aa) A `catch` that sets a new `fallback` while its boundary is already hidden by a suspension now shows that fallback, instead of the one drawn when the boundary hid.
- Updated dependencies [[`72f0d74`](https://github.com/gabeklein/expressive-mvc/commit/72f0d742007dfd23b9103b314a9367319de50f7b)]:
  - @expressive/mvc@0.94.1

## 0.9.0

### Minor Changes

- [#614](https://github.com/gabeklein/expressive-mvc/pull/614) [`38b995b`](https://github.com/gabeklein/expressive-mvc/commit/38b995b0df5c4b959490fc03540ef7e6acb81665) Descendant scopes apply only to elements the caller's own JSX writes. A nested rule under a `_rule` on a child component element, such as `_card: { _label: {...} }`, no longer styles `_label` elements inside the child's render. The class from `_card` still reaches the child's root through `style`, and `children` the caller passes in still take the nested rules. A child meant to be restyled from outside exposes that through `style` or a managed prop.

- [#609](https://github.com/gabeklein/expressive-mvc/pull/609) [`79e1e88`](https://github.com/gabeklein/expressive-mvc/commit/79e1e88622f3f5e9c1c3eacc058320c1955d2457) A rule, condition or subcomponent body in a `style()` map may be an array of maps, merged in order at every depth with falsy entries skipped - `_bar: [tabs, { [wide]: { _button: { height: '30px' } } }]` instead of re-spreading each nested level.

  Repeated `style()` layers now merge nested `_` scopes rule by rule; previously a later layer's `_item` replaced an earlier layer's.

- [#612](https://github.com/gabeklein/expressive-mvc/pull/612) [`075c694`](https://github.com/gabeklein/expressive-mvc/commit/075c69461020699c74c86a400eb7beb524ef0ff8) Macro packs are classes. Extend `Style` (or the shipped `Css`, which replaces `css`) with one method per macro, and `App.use()` returns a `style` whose maps are typed from the class - no `macro.Registry` augmentation. A component's maps resolve against the pack that styled it. Subclasses layer over their base, falling through as before, and `'*'` is a method.

  Breaking: `macro()`, `macro.Registry`, `macro.From` and `css` are removed, and with them global rules. Move `macro({ _button: … })` element defaults into a shared map layered as an extra `style()` argument.

### Patch Changes

- [#608](https://github.com/gabeklein/expressive-mvc/pull/608) [`b3a272b`](https://github.com/gabeklein/expressive-mvc/commit/b3a272b1c70cec00c47373039c7f4f68a6f48f01) A `_rule` under a top-level `:` state combined with an `@` condition, in either order, now styles its descendants instead of being dropped.

## 0.8.2

### Patch Changes

- [#600](https://github.com/gabeklein/expressive-mvc/pull/600) [`c20f54e`](https://github.com/gabeklein/expressive-mvc/commit/c20f54e815da87c137b4f7ba04ebdf5c70b5d3f9) `media()` returns a literal type built from the query, so its result works as a computed key in a typed `style()` map. Features are joined in the order of the query interface rather than insertion order.

- [#603](https://github.com/gabeklein/expressive-mvc/pull/603) [`de29195`](https://github.com/gabeklein/expressive-mvc/commit/de291952b8696897a8792e558888bf74f5482d89) Popping a context destroys the Components the renderer constructed within it, as in the React and Preact hosts.

## 0.8.1

### Patch Changes

- [#598](https://github.com/gabeklein/expressive-mvc/pull/598) [`f4cb7aa`](https://github.com/gabeklein/expressive-mvc/commit/f4cb7aa2df567473ed0e080da57c9b0b3c9d9bf8) Importing `@expressive/dom` no longer fails to typecheck with circular-type errors in the style macros (`'css' implicitly has type 'any'`, `Type 'Registry' recursively references itself`) in projects that compile its source.
- Updated dependencies [[`0eba921`](https://github.com/gabeklein/expressive-mvc/commit/0eba921db3ef0f10fda222b42ef270c8de0cb781)]:
  - @expressive/mvc@0.94.0

## 0.8.0

### Minor Changes

- [#589](https://github.com/gabeklein/expressive-mvc/pull/589) [`bdee9a1`](https://github.com/gabeklein/expressive-mvc/commit/bdee9a1715f9b080e9376022237b3a56a8b7cc12) An effect declared during construction of a Component the renderer owns holds its first run until the component is inserted. `mount()` is removed: declare the effect in `new()` instead.

- [#587](https://github.com/gabeklein/expressive-mvc/pull/587) [`22fc3c5`](https://github.com/gabeklein/expressive-mvc/commit/22fc3c5308c6eff4e8fc9d1e0921cfcbe2ed1348) JSX now resolves `style()` rules in the component that wrote it. `children` passed to a wrapper - a router `Link`, a provider Component with no `render()`, any FC that places `children` - keep the author's rules, including rules nested in a `_rule` on the wrapper element. The wrapper's own rules no longer reach them; its base declarations still apply where they are its roots.

- [#595](https://github.com/gabeklein/expressive-mvc/pull/595) [`e1d6fde`](https://github.com/gabeklein/expressive-mvc/commit/e1d6fde1cf8c2c48eebcf1ae911fc3cad69e9775) The `css` pack drops its `mx`, `my`, `px` and `py` macros - use the logical properties `marginInline`, `marginBlock`, `paddingInline` and `paddingBlock`, which `css` sizes like any other. `size` stays.

- [#593](https://github.com/gabeklein/expressive-mvc/pull/593) [`daded68`](https://github.com/gabeklein/expressive-mvc/commit/daded68fc124fbdb177c572cdab3cc9d1e8f9462) Add `macro.From<typeof pack>` to declare a macro pack's `Registry` entries from its value: `interface Registry extends macro.From<typeof app> {}`.

  A macro whose argument is optional now type-checks as a flag: `row: true`.

- [#594](https://github.com/gabeklein/expressive-mvc/pull/594) [`55fb14c`](https://github.com/gabeklein/expressive-mvc/commit/55fb14c6e146d1dfcfdc105613a398dd81a0a3cf) Style maps take conditions: a `:state` or `@media …` key holds a map applied while it holds - at the top of a map, inside a rule, or nested. `:` keys split on commas into alternatives, and pseudo-elements (`::placeholder`) apply to that part; `_rule` inside an `@` condition applies that rule under it. Condition blocks sort after the block they modify and add no specificity, so doors still win. Adds `media({ maxWidth: 900 })` and the `style.Condition` type.

- [#596](https://github.com/gabeklein/expressive-mvc/pull/596) [`d6eb0c7`](https://github.com/gabeklein/expressive-mvc/commit/d6eb0c74b98868930669cfff0ae21dcb55fc229c) A `_rule` inside a `:state` condition styles descendants while the enclosing element holds that state: `_thumb: { ':hover': { _delete: { opacity: 1 } } }`.

- [#592](https://github.com/gabeklein/expressive-mvc/pull/592) [`9fd7144`](https://github.com/gabeklein/expressive-mvc/commit/9fd71442b71dc22fd46084680c6065fccbfdd5a2) `style()` takes several maps, layered in order as repeated calls would, skipping falsy entries: `style(Meta, shared, wide && compact, { whiteSpace: 'normal' })`.

- [#591](https://github.com/gabeklein/expressive-mvc/pull/591) [`dbc7b86`](https://github.com/gabeklein/expressive-mvc/commit/dbc7b862c3df2b3446af3f6a1e8583880f884ff1) Add `rem`, `em` and `px` value helpers: `rem(0.2, 0.45)` is `'0.2rem 0.45rem'`.

### Patch Changes

- [#585](https://github.com/gabeklein/expressive-mvc/pull/585) [`99dadb9`](https://github.com/gabeklein/expressive-mvc/commit/99dadb9a81c59e1b371fc9b412830b10d7ec6115) Published types now include the `Component.mount` augmentation. It was emitted in a declaration chunk nothing referenced, so a `mount()` method went unchecked against its signature.

- [#584](https://github.com/gabeklein/expressive-mvc/pull/584) [`cbe3280`](https://github.com/gabeklein/expressive-mvc/commit/cbe32803504813cc634543fc6909c838f89a0769) Base declarations in a `style()` map now beat `macro()` global rules, as documented. A component's own rule shadowing a global one stacks on it instead of merging it in. A component instance placed as `{child}` no longer inherits the placing component's base declarations or rules. A macro returning its own name as `true` with nothing below it now throws `Macro "name" returned itself.`, and the host rejects a bare `true` value.
- Updated dependencies [[`c2a6b40`](https://github.com/gabeklein/expressive-mvc/commit/c2a6b4064fac8000e0cb7b0212d02345a87f6621), [`bdee9a1`](https://github.com/gabeklein/expressive-mvc/commit/bdee9a1715f9b080e9376022237b3a56a8b7cc12), [`d37a20d`](https://github.com/gabeklein/expressive-mvc/commit/d37a20d917767705c18b445c036ab74f432bd3e7), [`1c2c81f`](https://github.com/gabeklein/expressive-mvc/commit/1c2c81fc43b437b55797e91043245d95b1662aa7), [`776243b`](https://github.com/gabeklein/expressive-mvc/commit/776243b0ce94bd7b4b81d4ad1a290d33abe4b8bb), [`ac2cd5c`](https://github.com/gabeklein/expressive-mvc/commit/ac2cd5caca0ad91777fb23d038bfbec67e88ea93), [`a183961`](https://github.com/gabeklein/expressive-mvc/commit/a183961f28b4124049700fb9e2442723fe3ec7ab), [`4d0c270`](https://github.com/gabeklein/expressive-mvc/commit/4d0c270b0914ba39e5f8b549fac962d9be5aff87), [`1c2c81f`](https://github.com/gabeklein/expressive-mvc/commit/1c2c81fc43b437b55797e91043245d95b1662aa7), [`245e59a`](https://github.com/gabeklein/expressive-mvc/commit/245e59ac0f0ac0b33e586219e6ee188a5d7cbe07)]:
  - @expressive/mvc@0.93.0

## 0.7.0

### Minor Changes

- [#551](https://github.com/gabeklein/expressive-mvc/pull/551) [`3cefd2d`](https://github.com/gabeklein/expressive-mvc/commit/3cefd2d95f3e6a344b7f2d4c82d03ae2dd89b55f) Outside render, `Model.get()` no longer throws - it reads the root context, untracked, which may not be the instance the component rendered. Read it in render and use that in handlers. A class overriding static `get` keeps tracking.

- [#567](https://github.com/gabeklein/expressive-mvc/pull/567) [`afd750c`](https://github.com/gabeklein/expressive-mvc/commit/afd750c8e6d3a35321daeb29e8e4c10a1e824d9d) `Model.get` no longer accepts a function: the computed (`Model.get(fn)`), effect (`fn` returning `null`) and async forms are removed, with `Model.ForceRefresh`, `Model.GetFactory` and `Model.GetEffect` (react) and `Model.ForceRefresh` and `Model.GetFactory` (dom). Destructure and derive in render, declare a getter on the Model, or move side effects to `mount()`.

  `Model.get(true)` (required values, `Required<T>`) is removed. Hold a value that may be unset as a Model field - it joins its owner's context. Destructure it and render conditionally (`if (draft) return <Editor />`); the child reads it with `Draft.get()`. A value with its own view is a `Component`, placed as `{draft}`. `Model.get()` and `Model.get(false)` are unchanged.

- [#565](https://github.com/gabeklein/expressive-mvc/pull/565) [`a6341f7`](https://github.com/gabeklein/expressive-mvc/commit/a6341f781df6bf5bddd61fd9bf50b6086e171583) `style()` maps address subcomponents by key. `_Title: { ... }` is the `Title` subcomponent's own map - base declarations for its roots, rules and tag matches for its output - resolved through the owner's class wherever it renders and composed through the class chain. Top-level rules still style `render()` output only. `_` plus a capital letter is reserved for this and throws when nested in a rule or written as an attribute on an element.

### Patch Changes

- Updated dependencies [[`3cefd2d`](https://github.com/gabeklein/expressive-mvc/commit/3cefd2d95f3e6a344b7f2d4c82d03ae2dd89b55f), [`c052455`](https://github.com/gabeklein/expressive-mvc/commit/c0524556b85ad598b2f6db774b639627b61cb337)]:
  - @expressive/mvc@0.92.0

## 0.6.0

### Minor Changes

- [#562](https://github.com/gabeklein/expressive-mvc/pull/562) [`aeb0787`](https://github.com/gabeklein/expressive-mvc/commit/aeb07871c5cfe30df9fd945f6c5f2c2832d94168) Context lookups are observable.

  - A tracked lookup re-runs when a change can alter its result - a closer provider arriving, the found one removed - and not for providers above the one found, other types or siblings.
  - `this.get(Type)` inside an effect or render now refreshes when its provider changes. A required lookup whose provider is removed throws.
  - dom: `Model.get` follows a provider replaced by a field assignment, arriving after mount or removed.
  - react: `Model.get` follows a provider arriving after mount, including an optional `Model.get(false)` that first found nothing, and one removed.
  - dom and react: once its instance leaves context, `Model.get(false)` returns `undefined` and a required `Model.get()` throws `Could not find`. Unmount consumers before destroying their provider.

### Patch Changes

- Updated dependencies [[`2bef0ed`](https://github.com/gabeklein/expressive-mvc/commit/2bef0ed387aa4060725644a90d1def7221117810), [`5e6689c`](https://github.com/gabeklein/expressive-mvc/commit/5e6689c8c18ec34323fccd881552e76b4354d11e), [`a55605b`](https://github.com/gabeklein/expressive-mvc/commit/a55605b2439078b2694abc2ac9361ca30fa2e119), [`aeb0787`](https://github.com/gabeklein/expressive-mvc/commit/aeb07871c5cfe30df9fd945f6c5f2c2832d94168), [`f5fc45a`](https://github.com/gabeklein/expressive-mvc/commit/f5fc45ae6105876438b3c17a87f1da2546fe0d63)]:
  - @expressive/mvc@0.91.0

## 0.5.0

### Minor Changes

- [#544](https://github.com/gabeklein/expressive-mvc/pull/544) [`86fee85`](https://github.com/gabeklein/expressive-mvc/commit/86fee85646b20548384a028940254e9deb466ae3) Remove `Model.use()` from `@expressive/dom`. Function components own no state - put owned state on a class: a Component field, a Model element, or `<Component for={Type}>` above a function component that reads it with `Model.get()`. Per-render arguments become attributes, which assign fields. `use` is no longer a reserved member on rendered instances. `@expressive/react` keeps `Model.use()`.

- [#546](https://github.com/gabeklein/expressive-mvc/pull/546) [`fdf2116`](https://github.com/gabeklein/expressive-mvc/commit/fdf211636b05788a233e16ddb5709028a042c076) Only a `Component` renders. A plain `Model` is no longer a JSX element or inline-renderable - `<Session />` and `{session}` throw, naming the fix: extend `Component` to render, or provide with `<Component for={Session}>`. `fallback`, `catch`, `mount`, `key` and `render` are no longer read from plain Models. Matches `@expressive/react`, where only Components render. PascalCase subcomponents on any Model are unchanged.

### Patch Changes

- Updated dependencies [[`d0b9cf6`](https://github.com/gabeklein/expressive-mvc/commit/d0b9cf6a29916f5db4c9eca23668c208540f9923)]:
  - @expressive/mvc@0.90.0

## 0.4.0

### Minor Changes

- [#528](https://github.com/gabeklein/expressive-mvc/pull/528) [`e37e87d`](https://github.com/gabeklein/expressive-mvc/commit/e37e87d8883eeec5e9477a18a52fe6103ccced87) Render composition is removed. A subclass `render()` now replaces its base's like any method override, on `Component` and on a rendered `State`, in every host. To keep a base's chrome around subclass content, render a subcomponent the subclass overrides (`<this.Body />`), or call `super.render(props)` from the override to wrap the base. `compose` is no longer exported from `@expressive/mvc/jsx-runtime`.

  Migration: a subclass `render()` that relied on being wrapped by its base's render moves to a subcomponent the base renders; a base that read the subclass output from `props.children` renders that subcomponent instead.

  `Route` keeps its behavior: a subclass `render()` is still the route's page, gated on match, guards and redirects, and run only when matched. `super.render()` inside it places the default content (`as` around `children`). A `Link` subclass `render()` still replaces the anchor.

### Patch Changes

- [#526](https://github.com/gabeklein/expressive-mvc/pull/526) [`f503478`](https://github.com/gabeklein/expressive-mvc/commit/f503478d7a3bbb851c8aba3c9303a8899bfe658e) `State` is renamed `Model`. `State` remains exported as a deprecated alias of the same class, so `extends State`, `instanceof State`, `State.*` namespace types and adapter augmentations keep working; migrate with a find-and-replace. One exception: code that augments the class through `declare module '@expressive/mvc' { interface State { … } }` must augment `Model` instead - augmenting `State` declares a separate interface that shadows the alias's type. `Component.StateProps` is now `Component.ModelProps`, with `StateProps` kept as a deprecated alias.

  `@expressive/react` and `@expressive/dom`: error messages and the hot-reload plugin's generated code refer to `Model`.

- Updated dependencies [[`7b2e8a1`](https://github.com/gabeklein/expressive-mvc/commit/7b2e8a11030000ce005a7681b11047c9b75cda76), [`d194d33`](https://github.com/gabeklein/expressive-mvc/commit/d194d33695e39b133d8a3284819713b6460baeaa), [`e37e87d`](https://github.com/gabeklein/expressive-mvc/commit/e37e87d8883eeec5e9477a18a52fe6103ccced87), [`94ec898`](https://github.com/gabeklein/expressive-mvc/commit/94ec8987c8030a2acd19bde38075877869d1599a), [`f503478`](https://github.com/gabeklein/expressive-mvc/commit/f503478d7a3bbb851c8aba3c9303a8899bfe658e)]:
  - @expressive/mvc@0.89.0

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

- [#456](https://github.com/gabeklein/expressive-mvc/pull/456) [`aa8bfe2`](https://github.com/gabeklein/expressive-mvc/commit/aa8bfe23bb39d32008ebd1e4ba72d2f18391dbbe) A `pending()` update that reveals new content whose State suspends - a `State.use()` slot, an owned child, or a State element loading data - now holds the current screen and commits once the data arrives. Previously the new State was destroyed while its value was still loading, an unhandled "is destroyed" rejection escaped, and the update never committed. Router navigates through `pending()`, so navigating to a page whose State loads on entry was affected. New content the update adds stays off the page until it commits - the waiting part, markup around it, and new siblings beside it - and the content it replaces stays meanwhile. `mount()` on new State runs once it is on the page, and never for new content an unhandled error discards.

- [#493](https://github.com/gabeklein/expressive-mvc/pull/493) [`b4ca589`](https://github.com/gabeklein/expressive-mvc/commit/b4ca589a276bcd37bdbdcf6405efe0bd42179105) `Host` takes `elementClass`, the instance a class must construct to render on that host; `JSX.ElementType`'s class arm reads it, so a type written against `@expressive/mvc/jsx-runtime` (like router's `as`) renders under the host's own JSX. React and Preact declare their `Component`, dom declares `State`. The class arm is no longer `abstract`.

- [#441](https://github.com/gabeklein/expressive-mvc/pull/441) [`397c212`](https://github.com/gabeklein/expressive-mvc/commit/397c212d7df9b23b9fe153ce76fb5ad7ce9543bc) **Breaking:** `@expressive/mvc/runtime` is removed. Host seams (`host`, `HostRuntime`, `Host`, `childrenOf`, `isElement`, `typeOf`, `propsOf`) move to `@expressive/mvc/jsx-runtime` beside the transform contract (`jsx`, `jsxs`, `jsxDEV`, `Fragment`, `JSX`); class HMR moves to its own subpath, `@expressive/mvc/hot`, exporting `accept` and `replaced`.

  - Host seam imports from `@expressive/mvc/runtime` → `@expressive/mvc/jsx-runtime`.
  - `import { hot } from '@expressive/mvc/runtime'` → `import * as hot from '@expressive/mvc/hot'`.
  - `declare module '@expressive/mvc/runtime'` augmentations of `Host` → `declare module '@expressive/mvc/jsx-runtime'`.

  Adapters, router, inspect, and the Vite plugins import the new path.

- Updated dependencies [[`f6d9d81`](https://github.com/gabeklein/expressive-mvc/commit/f6d9d81951916e216c5ded575a93eb8c11389a5e), [`606bd37`](https://github.com/gabeklein/expressive-mvc/commit/606bd3701546e99719628815e88c34ceb2d94978), [`29d1a48`](https://github.com/gabeklein/expressive-mvc/commit/29d1a481d4d58a85c46bf67ac2656f61bef95061), [`d816f89`](https://github.com/gabeklein/expressive-mvc/commit/d816f896d9a89060aca394ec1d41f6bcf11010a2), [`13b9fd5`](https://github.com/gabeklein/expressive-mvc/commit/13b9fd55b57fb701957ef1085598b7f5f6db627d), [`d804a68`](https://github.com/gabeklein/expressive-mvc/commit/d804a68e987b5e8914e99aaebc7dcae3cc858df1), [`bf7da4a`](https://github.com/gabeklein/expressive-mvc/commit/bf7da4a6356ff8224b9d5f8127ff7a5217e4b714), [`f6d9d81`](https://github.com/gabeklein/expressive-mvc/commit/f6d9d81951916e216c5ded575a93eb8c11389a5e), [`b4ca589`](https://github.com/gabeklein/expressive-mvc/commit/b4ca589a276bcd37bdbdcf6405efe0bd42179105), [`0863b57`](https://github.com/gabeklein/expressive-mvc/commit/0863b572541950346ec90e439d25c6bb3a402f35), [`5735f12`](https://github.com/gabeklein/expressive-mvc/commit/5735f124bea800a3e87835e41dd99f10c468da03), [`5fa6a0e`](https://github.com/gabeklein/expressive-mvc/commit/5fa6a0e6fa69a7afde9c02caa3f8bcf3367d5dbe), [`397c212`](https://github.com/gabeklein/expressive-mvc/commit/397c212d7df9b23b9fe153ce76fb5ad7ce9543bc), [`6993e16`](https://github.com/gabeklein/expressive-mvc/commit/6993e166a5b355790c6fbdae9d3b2674dcf86dd2), [`6b6498c`](https://github.com/gabeklein/expressive-mvc/commit/6b6498c334402e17a89951f4b82a8a689e361dc4), [`3390c35`](https://github.com/gabeklein/expressive-mvc/commit/3390c35059ee5290fb4c1a050b2bfd1fd0305065)]:
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
