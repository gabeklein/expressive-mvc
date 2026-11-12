---
name: expressive-dom
description: Expressive MVC's DOM renderer (@expressive/dom) - renders Model/Component classes straight to browser DOM without React. Use when building or debugging an @expressive/dom app - render/unmount, style() and Style, FC render scopes, native events, code splitting and boundaries, transitions, portals, Vite hot reload. Core Model API lives in the expressive-mvc skill.
---

# DOM renderer

`@expressive/dom` renders MVC components directly to browser DOM. It has no React or Preact dependency.

## Status

A tested browser renderer, pre-1.0 - not an LTS contract. Use it for applications prepared to track minor releases. The documented behavior is intentional; package shape and extension seams may change before stabilization. Renderer internals are private—import only the package root, its JSX runtime entries and `/server`.

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/dom"
  }
}
```

```tsx
import { Model, Component, pending } from '@expressive/mvc';
import { Portal, render } from '@expressive/dom';
```

## Render

`render(node, container)` replaces an existing root in the container and returns an idempotent unmount function.

```tsx
const unmount = render(<App />, document.getElementById('app')!);
unmount();
```

Classic JSX (`"jsx": "react"`, or a toolchain without an automatic runtime) uses `createElement(type, props, ...children)` and `Fragment` from the package root - set `jsxFactory: "createElement"` and `jsxFragmentFactory: "Fragment"`, or `import * as React from '@expressive/dom'` under tool defaults (the root also exports the `JSX` namespace type). Attribute typing matches the automatic runtime. `Fragment` also serves keyed fragments: `<Fragment key={id}>…</Fragment>`.

Supported output: intrinsic HTML/SVG elements, fragments, strings/numbers/bigints, FCs, `Component` classes and instances, `has.List` / `has.Pool`, `map.Managed`, portals, arrays, and empty boolean/null/undefined values. Keys preserve DOM ranges across reorder.

Events are native `addEventListener` listeners (`onClick`, `onKeyDown`, `onClickCapture`) with native event objects and propagation. There is no synthetic event layer: `onChange` on a text field fires on commit - use `onInput` per keystroke. Names are native event names; `onDoubleClick` is also accepted for `onDblClick`. `event.currentTarget` is typed as the element; `event.target` is not, since it may be a descendant.

`value` and `checked` apply after children and other props and are compared with the live element on every render, so `<select value>`, range bounds, and bound inputs follow state. As in React, a controlled `value` or `checked` is restored after the event its handler listens to (`onInput` → `input`, `onChange` → `change`; with no handler, `change` for checkboxes, radios and selects, `input` otherwise), once any resulting render has landed. A handler that rejects input - or no handler at all - keeps the field on state; accepted input is left untouched, caret included. Both are properties only: no `value`/`checked` attribute and no textarea text, so `form.reset()` clears bound fields rather than restoring the last render, and `[value=…]` selectors do not match. `className`, `style`, `dangerouslySetInnerHTML`, callback/object refs, DOM properties, `data-*`, and `aria-*` are supported. `data-*`, `aria-*`, `draggable`, `spellcheck` and `contenteditable` write booleans as `"true"`/`"false"` - pass `undefined` to omit one for presence selectors. `autofocus` (or `autoFocus`) focuses the element when it is inserted into the document (browsers honor the attribute only at page load).

## Styles

`style` recursively flattens arrays. Falsy entries are ignored, strings become DOM class tokens, and objects merge left-to-right into inline declarations. The inline result follows the browser cascade and normally overrides class rules. Use `className` for an external browser-only class; it is prepended to classes from `style`.

```tsx
<button
  className="external-widget"
  style={[
    'button',
    active && 'active',
    [compact && 'compact', { width }]
  ]}
/>
```

Classes use React's `className` - the DOM property name. The attribute spelling `class` is not accepted, and is ignored through untyped spreads. A string in `style` is a class token, not CSS declaration text. Treat arrays and objects as immutable render values—replace them when their contents change.

### Component appearance rules

Register immutable maps with `style(Component, map)`. A `_name` entry is a **rule** - a static block. Bare keys are declarations, or **macro** calls where the pack owns the name.

```tsx
// style.ts
import { Css } from '@expressive/dom';

class App extends Css {
  gutter(value: number) {
    return { paddingInline: value };
  }
}

export const style = App.use();
```

```tsx
import { style } from './style';

function Button({ active }: { active: boolean }) {
  return <button _active={active}>Save</button>;
}

style(Button, {
  padding: '8px',
  _active: { fontWeight: 700 },
  _raised: { gutter: 4, boxShadow: '0 1px 2px black' }
});
```

- A rule applies when `_name` is truthy on an element, or when the element's host tag is `name`. `0` and `''` do not activate - a rule is on or off, while a macro still treats `0` as a value. Each applied rule is one class named after its source, such as `Button_active`. Nested inside a rule body, `_name` opens a descendant scope.
- A rule named for a tag (`_label`, `_small`, `_time`) also styles every such element the component renders - pick another name for a flag-only rule.
- Bare keys at the top of a map form a **base rule** applied to each of the component's host roots - `padding` above styles every root `Button` renders, through fragments.
- A map never reaches inside a child component, placed as an element or an instance. Rules, base declarations, tag matches and descendant scopes apply only to elements the component's own JSX writes - a `_rule` on a child component element styles that child's root, never its internals. JSX resolves in the scope that wrote it: `children` passed to a wrapper keep the author's rules - including rules nested in a `_rule` on the wrapper element - and the wrapper's rules do not reach them; its base declarations still apply where they are its roots. Only the class chain inherits - `Derived` sees `Base`'s rules.
- A map styles `render()` output only, not subcomponents (`expressive-mvc/component.md#subcomponents`). `_` plus a capital letter addresses one by key: its body is that subcomponent's own map - base declarations for its roots, rules and tag matches for its output - resolved through the owner's class wherever it renders. A `_Title` body belongs to the class whose prototype defines `Title()` - a subclass inheriting `Title` gets the definer's body, one overriding it starts unstyled with only its own. `style(Fancy, { _Title })` throws unless `Fancy` defines `Title()`; to restyle an inherited piece, override it, or put a rule on it from the owner (`<this.Title _title />`, styled `_title`). A PascalCase field holding a function is not a subcomponent - it styles itself with `style(fn, …)` and reads its owner with `Card.get()`. `_Title` nested in a rule, or as an attribute on any element, throws. To share rules, pass one map to both: `style(Card, shared, { _Title: shared })`.

```tsx
style(Card, {
  _active: { color: 'red' },        // render() only
  _Title: {
    fontWeight: 700,                // Title's roots
    _active: { color: 'blue' }      // Title's output; class Card_Title_active
  }
});
```
- Component names never match; minifiers rename them. A caller styles a child through `_rule` on the component element, which travels by door. A class Component declaring a matching unmanaged `_` field also receives the value (`expressive-mvc/state/state.md#unmanaged-instance-data`). The value is not reactive, and writing it does not restyle - style is resolved in the caller's render. A component styles its own output through `_rule` in its own render; anything driving behavior belongs in a managed prop.
- `$name` is a condition or variable named on the pack ([Conditions](#conditions), [Variables](#variables)); an unknown one throws, as does one written as a value string (`color: '$brand'`) - values use tokens ([Variables](#variables)).
- `false`, `null`, and `undefined` omit an entry; `0` is a value. `_` attributes are style-only and never reach the DOM.
- Under the dev JSX runtime, a `_name` attribute that no rule matches warns once with the nearest rule name. It counts the writing component's rules, the receiving component's own, and a class Component's `_` field; a `_name` a component received and spreads on is checked where it was written. A rule supplied conditionally (`App.use(wide && rules)`) warns while absent - declare it empty (`_cell: {}`) where it is always present.

Macros are methods of a `Style` subclass, a **pack**; `App.use()` returns the `style` resolving them, one per class. Plain `style` from `@expressive/dom` has none. Apps extend `Css` (or their own subclass of it); `Style` is the base for a new host's pack. A getter, a `_` or `$` method, or a field other than a `$name` string throws. Every method is a macro - TypeScript's `private` included, since it only hides the name from types. Keep utilities in `#private` methods or at module level; methods bind to one instance, so a macro may call `this.#helper()`. Statics are never macros. A component's maps resolve against the pack that styled it wherever it renders, so one component takes one pack - a second throws. `style(X)` with no map joins the pack; subclasses and subcomponents inherit their owner's. A macro's parameter may be an object - a bare key is never a scope, so `transform: { translateY: -2 }` reaches a `transform(value: Transform)` macro whole, typed by its interface, and a layer replaces it whole. A function inside a map is a value, not a definition - rules are static, so call a plain function in place.

A key resolves at its topmost definition, the subclass first; a macro returning its own name falls to the next definition down (or calls `super`), then through any `default(value, key)` method, then to the host. `default` is not a map key. An override must stay assignable to the method it overrides - annotate the base's return as `object` when shapes differ. A macro returning its own name as `true` with no named definition below throws. The host joins arrays with spaces, rejects a function, object or `true` (`No macro handles "gutter"`), and never adds units - a macro owns them, so write `padding: '8px'`, not `padding: 8`.

**Pack rules.** Maps passed to `use()` hold rules for every component that `style` styles - element defaults (`_button`), app roles (`_muted`), condition blocks (`$dark: { _button: … }`):

```ts
export const style = App.use(base, {
  _button: { padding: '8px', color: text },
  _muted: { color: muted }
});
```

They apply only to elements written by a component styled through it, below that component's base declarations and rules; a component's own `_button` merges with the pack's. A declaration outside a rule throws, except a variable default ([Variables](#variables)). Each `use()` with maps is a separate scope - one class can serve an app shell and an embeddable widget - while `use()` without maps is shared per class. Children an app passes into a library component keep the app's rules. A component rendering host elements calls `style()`, even with no map - the pack is never inferred from context.

Repeated `style()` calls add layers and return the component unchanged. One call may take several maps - `style(Meta, assetMeta, wide && compact, { whiteSpace: 'normal' })` layers each in order and skips falsy entries. Layers merge rule by rule at every depth - conditions and nested `_` scopes included; spreading (`{ ...assetMeta, _name: … }`) replaces `assetMeta._name` instead. A rule, condition or subcomponent body may be an array, merged the same way, falsy entries skipped - a shared map with nothing to add needs none (`_tabs: tabs`). Prefer it to spreads for overriding a shared map - a spread replaces each nested level, so every level must re-spread its shared counterpart, and a level later added to the shared map is dropped:

```tsx
_bar: [tabs, { [wide]: { _button: { height: '30px' } } }]
// not: { ...tabs, [wide]: { ...tabs[wide], _button: { ...tabs[wide]._button, height: '30px' } } }
```

Within a scope, base declarations come first, then rules by base class, derived class, and registration order. A rule first named inside a descendant scope (`_list: { _item: … }`) sorts after every rule of the enclosing scope, wherever it is written; a top-level rule meant to override it belongs in the same scope. A component's registrations close at *its* first render - a lazily loaded module may still call `style()` later for a component that has not rendered.

Inline style always beats classes. Among classes, a caller's rule beats the callee's: a `_rule` on a component element travels as a token through `style`, and each component `style` prop crossed - forwarded or handed on explicitly - adds a door. More doors wins, independent of render or emission order. Blocks emitted past the first door carry a `-dN` suffix. Generated classes are not a selector contract - code and tests find elements by `data-*`, `id` or role.

### Conditions

A key starting with `:` (state) or `@` (environment) holds a map that applies while the condition holds - at the top of a map (the component's roots), inside a rule, or nested in another condition. A `$name` field on the pack names one; `$name` keys resolve to it, and a subclass overrides it like a macro:

```tsx
import { Css } from '@expressive/dom';

class App extends Css {
  $mobile = '@media (max-width: 900px)';
  $open = ':is([open])';
}

export const style = App.use();

style(Select, {
  ':hover': { opacity: 1 },
  _control: {
    border: '1px solid var(--border)',
    ':hover, :focus-within': { borderColor: 'var(--accent)' }
  },
  _grid: { gridTemplateColumns: '1fr 1fr' },
  $mobile: { padding: '4px', _grid: { gridTemplateColumns: '1fr' } }
});
```

- Each condition is its own block, sorted right after the block it modifies. It adds no specificity, so doors and inline style win over it as over any rule.
- A `,` in a `:` key lists alternatives (`:is(...)` stays whole); an `@` key is never split.
- `':is([data-mode="dark"] *)'` holds while an ancestor or `<html>` matches - the zero-specificity form of `[data-mode="dark"] .thing`.
- A pseudo-element (`'::placeholder'`, `':hover::after'`) styles that part of the element and cannot hold a `_rule`.
- `_rule` inside an `@` condition applies that rule under it, at the top level or as a descendant scope.
- `_rule` inside a `:` condition styles descendants while the enclosing element holds the state - `_thumb: { ':hover': { _delete: { opacity: 1 } } }` shows `_delete` while its thumb is hovered; at the top of a map, the state is the component root's. The element holding the state gets a `-group` class. Groups chain and combine with `@`.
- Macros expand inside a condition; one producing a class there throws.
- CSS names are the vocabulary; each host decides what a condition means. Maps meant to move between hosts should use named conditions (`$mobile` above).
- Layers and subclasses merge a condition's body key by key, like a rule.

A condition's `$name` field starts with `@` or `:`. The `style.Condition` type (`` `:${string}` | `@${string}` ``) types a condition held elsewhere.

### Variables

A `$name` field that is not a condition is a CSS variable. Its value is either a default - the variable is named from the key (`$inkLight` → `--ink-light`) - or a `--name` to use as is, with values supplied elsewhere. Declare `$` fields `readonly` so their literals type the keys:

```ts
class App extends Css {
  readonly $ink = '#222';
  readonly $gap = '8px';
  readonly $brand = '--acme-brand';
  readonly $mobile = '@media (max-width: 900px)';
  readonly $dark = ':is([data-mode="dark"], [data-mode="dark"] *)';
}

export const style = App.use(($) => ({
  $dark: { $ink: '#eee' },
  $mobile: { $gap: '4px' },
  _a: { color: $.brand }
}));

style(Card, ($) => ({ border: ['1px', 'solid', $.ink], padding: $.gap }));
style(Callout, { $ink: 'crimson' });
```

- A default is emitted once at `:where(:root)`. Values are CSS text - write `'8px'`, not `8`.
- As a key, a variable declares itself where it is written. In `use()` rules, at the top or under conditions only, it is a default at `:where(:root)`; in a component map or rule, it overrides for that element and its subtree, every consumer below included.
- A map given to `style()` or `use()` may be a function of the pack's tokens, called once at that call - not per render, and without props. Each token is `'var(--ink)'`, keyed without `$` - a plain string, for templates, arrays and macro arguments. A condition has none.
- Tokens exist only inside those maps. A value picked at render time is a plain string - `` style={{ color: `var(--status-${kind})` }} ``.
- `:root` values under a `:` condition apply while `<html>` matches - a state meant for both, like `$dark` above, lists the element itself (`[data-mode="dark"], [data-mode="dark"] *`).
- Names are global CSS. An app may use bare names; a library uses `--prefix-name` fields so apps and plain CSS can set them without collisions.
- A theme may live in a CSS file instead: `--name` fields with no defaults give typed keys and tokens, and the stylesheet supplies values and modes.
- A variable only one component uses needs no field - write `'--today': 'red'` and `'var(--today)'`.

### The web pack

`Css` is the web pack shipped with the renderer - units for numbers, milliseconds for durations and a `size` shorthand. Apps extend it, or use it as is:

```ts
import { Css } from '@expressive/dom';

export const style = Css.use();
```

A number gets `px` only where the CSSOM rejects a bare one - probed once per property, so `zIndex: 3`, `lineHeight: 1.5` and `fontWeight: 700` stay unitless while `paddingTop: 5` and `marginBlockEnd: 2` do not. Every entry of a sequence is sized, so `margin: [1, 2]` is `1px 2px`. Write other units as strings (`'0.85rem'`). `transitionDuration`, `transitionDelay`, `animationDuration` and `animationDelay` are macros taking numbers as milliseconds, `0` included - an array joins with commas. `transition` takes an object keyed by property - `{ opacity: 200, transform: { duration: 300, easing: 'ease-out', delay: 50 } }` is `opacity 200ms, transform 300ms ease-out 50ms`; a string passes through, and a layer replaces the object whole. `rotate` and `offsetRotate` take degrees. A property where px is wrong gets a macro with its own unit, never a bare number. Maps accept a number only for a property where one is valid CSS - `color: 5` is a type error. Strings only where a number's role is ambiguous: `animation` (a time or a count), `font` (a weight or a size), `counterReset` (the count would get px). `flex` and `columns` take one number, not a sequence - write `flex: '1 1 200px'`. happy-dom accepts bare numbers browsers reject, so unit behavior is verified by the cascade probe, not unit tests. `size` sets width and height; for an axis use the logical properties - `marginInline`, `paddingBlock`.

Without the pack the terminal never guesses: a rule needs `padding: '8px'`, and a bare number reaches CSS unchanged - so a map for a pack with no `default` accepts numbers only where a bare one is valid, plus `0`.

### Typing

Maps are typed by the pack: a bare key must be a CSS property or a method of the pack, `_name` opens a rule, a `:` or `@` key holds a condition's map, and anything else is rejected - `colr` reports *Did you mean 'color'?* rather than throwing at the terminal. A bare key never takes an object, which is what separates `margin: '0 8px'` from `_margin: { ... }`.

A macro's first parameter types its value; an optional one also takes `true` (`row: true` calls it with none), and a macro with none is a flag taking only `true`. The pack's `style` is `style.Apply<App>`, and `style.Map<App>` types a shared map for it. Plain `style.Map` calls no macros - CSS properties, rules and `--variables` work as they are.

```ts
class App extends Css {
  row(gap?: string) { return { display: 'flex', alignItems: 'center', gap }; }
  edge(side: 'Top' | 'Left') { return { [`border${side}`]: '1px solid' }; }
}

export const style = App.use();
export const toolbar: style.Map<App> = { row: '4px', edge: 'Top' };
```

Property keys follow lib.dom's `CSSStyleDeclaration`, which omits some vendor properties. Add a pack method returning one under its own name (`WebkitTapHighlightColor(value: string) { return { WebkitTapHighlightColor: value }; }`) - the key falls through to the host as a declaration.

`className` is element-only. `style` on a component forwards through component and transparent boundaries to its host root; fragment output applies it to every host root. Reading `style` during render - destructuring, a spread, `this.props.style`, or a declared `style` field on a Component - takes ownership and suppresses forwarding for that render. Forwarded style overrides the root's own, and the outermost caller wins; a component wanting the last word consumes `style` and places it first:

```tsx
function Field({ style }: { style?: JSX.IntrinsicElements['div']['style'] }) {
  return <label><input style={['field', style]} /></label>;
}

<Field style={['invalid', { color: 'red' }]} />;
```

A component reading `style` receives a frozen object, or `undefined` when nothing was passed. Its own keys are the caller's inline declarations, flattened in written order; classes travel hidden with it. Override with a spread (`{ ...style, color: 'blue' }`), drop a key with rest (`const { width, ...rest } = style`), or merge two with `{ ...a, ...b }` - classes survive all three. Combine style values with arrays (`[a, b, 'local']`); spread to edit declarations. Do not branch on its shape, and do not clone it - `structuredClone` and JSON drop the classes.

### Conventions

Opinionated, applied by default:

- `style(X, …)` sits directly below `X`, never gathered at the end of a file. Shared maps go above their first use.
- One style module defines the app's pack - a `Css` subclass holding its macros - with its named conditions (`$mobile`) and variables (`$ink`), and exports its `style`, `$` and shared maps typed `style.Map<App>`. Components import them from it.
- A declaration group repeated in two or three places becomes a macro named for its job (`row`, `line`, `ellipsis`), not its CSS. What varies is its argument; an optional one makes it a flag (`row: true`). Fold repeats as you find them.
- Shared style: a macro groups declarations; app-wide rules - element defaults (`_button`), app roles (`_muted`) - go in `use()`; a shared map for one kind of thing is layered as an extra `style()` argument. Share a component before sharing a map.
- Values under `Css`: bare numbers for px, strings for any other unit or mixed value (`'0.2rem 0.45rem'`, `'0 auto'`, `calc()`, `var()`). A structured value that needs typing or units gets a macro taking an object.
- App elements are styled with `_rule` attributes; `className` is for classes defined outside `style()`. A hover or media hook class in app CSS belongs in a map as a condition.

## MVC render scopes

FCs have no renderer-owned state cells or effects. Treat them as pre-hooks stateless components whose MVC reads declare a dependency snapshot:

```tsx
function Total() {
  const { total, checkout } = Cart.get();
  return <button onClick={checkout}>{total}</button>;
}
```

`Model.get()` works in an FC, `Component.render()`, or a PascalCase subcomponent; outside render it reads the root context, untracked. Only values read through the returned tracking proxy invalidate that scope; same-value writes and unrelated fields do not render it. The lookup follows context - a provider replaced, arriving after mount or leaving renders the scope. Once the provider leaves, `get(false)` returns `undefined` and a required `get()` throws.

An FC owns nothing - same as React. Owned state is a class field or `<Component for={Type}>` above the FC; per-render arguments are attributes assigning fields - `expressive-mvc/component.md#props`.

Only a `Component` renders - as an element or placed inline (`{page}`). A plain `Model` is data: `<Session />` or `{session}` throws; extend `Component` to render, or provide it with `<Component for={Session} name="x">`. A view of a Model owns it as a field. A PascalCase method on any Model rendered as an element (`<this.Label />`, `<session.Badge />`, or passed on and rendered elsewhere) is a subcomponent tracking its owner; called directly it stays a plain method. A PascalCase function field is plain data and renders as an ordinary FC. Host-read members on a Component are `render`, `fallback`, `catch` and `key`; a field or method by one of these names opts into that behavior.

`<Component for>` (`expressive-mvc/state/context.md#providing-with-component`), implicit Component context, and context through portals use MVC `Context`; no renderer context API is exposed.

## Code splitting, boundaries, transitions

A function component returning a promise renders what it resolves to - a module's default export or a component itself (function or Component class): `const Settings = () => import('./Settings')`. Its first render suspends on the load; later renders and placements reuse the result without calling it again. Attributes pass to, and are typed from, the loaded component. It takes no parameters - props never change what loads. Declare it at module scope - one created per render loads every render. There is no `lazy`. A failed load rejects to the nearest `catch`; the next render after recovery loads again. A Component supplies a suspense boundary unless `fallback = false`; `fallback` and `catch` are members or attributes - `<Page fallback={<Spinner />} catch={(error, page) => …} />`. An attribute takes precedence over the member and still passes through to a field of that name. Function components never own a boundary; `fallback` on them is an ordinary prop. A placed instance (`{page}`) uses its members. `<Component fallback={…}>` adds one explicitly, with or without `for`. With no boundary above, a suspension throws from `render()` - give the root one: `fallback` on the top Component an FC `App` mounts (`<Layout fallback={null}>`), or `render(<App fallback={null} />, el)` when `App` is itself a Component. A suspension or caught error anywhere below replaces the whole boundary with one fallback; its content stays mounted off-document, keeps updating, and reveals at once when every waiting scope renders.

Suspending destroys nothing. Instances below a boundary - including one that suspends itself - keep their state and retry in place, so an instance may own its loading and error state and suspend in its own `render`. This holds on first mount and in a transition: new content a `pending()` update reveals waits off the page with the instances it created - Components, owned children - while the current screen holds, then commits with it. Each is created once, its effects run after it reaches the page, and it is destroyed only if a later render drops its position. A boundary for plain content is a bare Component:

```tsx
<Component fallback={<Spinner />}>
  <Report />
</Component>;
```

`catch(error, instance)` - member or attribute - handles render failures and retries after it completes (lifecycle failures go to `Model.on({ catch })` instead); until then the boundary holds its fallback, even if state written inside `catch()` would render cleanly. A rejected `catch()` escalates to the next boundary, which holds likewise. Handled errors are not logged. A boundary nested in a hidden one keeps its own state - an inner fallback still showing when the outer hides is still showing when it reveals.

```tsx
const Settings = () => import('./Settings');

class App extends Component {
  fallback = <p>Loading…</p>;

  render() {
    return <Settings />;
  }
}
```

MVC `pending(work)` runs `work` inline and defers subscriber DOM work. If the replacement suspends, the committed range remains until it can complete; an urgent suspension shows its fallback. Its promise resolves after the replacement commits or the affected scope unmounts. Scopes one transition updates commit together: if one suspends in its own render, or below a scope that currently renders nothing, none commit until it resolves - a route swap holds the outgoing page, and a guarded child does not render past its suspended guard. A suspension found deeper, inside content a scope already shows, holds that scope's range: what the transition adds there - the suspending part and new siblings beside it - waits off the page, and the content it replaces stays. Content it updates in place, in that scope or another, shows its update meanwhile. Transitions over separate scopes commit independently; a newer one on the same scope supersedes a held one.

`catch` retries once after it completes; a render that fails again keeps the fallback until state it read changes. A portal inside a hidden boundary is hidden with it; one first mounted while the boundary is hidden appears immediately.

```tsx
await pending(() => {
  router.page = 'settings';
});
```

## Portals

`<Portal into={element}>` renders its children into another `Element` or `DocumentFragment` while retaining logical MVC context, ownership and boundaries. `into` also takes a selector (`"#modals"`, `".layer"`), resolved once at mount and again only when the string changes; it throws unless exactly one element matches. Resolve anything else to an element yourself.

```tsx
return <Portal into={document.body}><Dialog /></Portal>;
```

## Server rendering

`renderToString(node)` from `@expressive/dom/server` renders without a DOM and resolves to `{ html, css }`: the container's markup as `render()` leaves it, range comments included, and the style rules it emitted.

```tsx
import { renderToString } from '@expressive/dom/server';

const { html, css } = await renderToString(<App />);
```

- Suspended renders and lazy components are awaited and retried in place - fallbacks never draw.
- `new()` runs; effects and `ready` do not. Every instance is destroyed once rendered.
- A `catch` boundary handles one error, then its component renders again; a second error rejects.
- Portals and event handlers render nothing. `value`, `checked` and `selected` become attributes; textarea `value` becomes its text.
- Numbers in `css` take `px` from a fixed table of unitless properties instead of the CSSOM, and values are not normalized - rule text can differ from the browser's while class names match.

There is no hydration: mounting with `render()` replaces the markup.

## Hot reload (Vite)

```ts
// vite.config.ts
import expressive from '@expressive/dom/vite';

export default defineConfig({ plugins: [expressive()] });
```

Editing a `Model` or `Component` class patches it in place - instances keep their values and re-render with the new methods, getters, `render`, subcomponents and `style()` maps (`expressive-mvc/state/lifecycle.md#hot-patching`). A field, constructor or `new()` change reloads the page, as does any edit to a module declaring a class with `#` private members. Dev server only. A class must be top-level `class X` or `let X = class`; `export default X;` exports a snapshot, so prefer `export default class X` or `export { X as default }`.

A top-level function component (`function View()`, `const View = () => …`, PascalCase) re-renders in place, in a module importing `@expressive/dom` - any `.tsx` on its JSX runtime. Components on another runtime, such as React email templates in server code, are left alone. An anonymous `export default` is not refreshed - the module reloads.

## Boundaries

The renderer targets the browser, with `renderToString` for servers: no native target, streaming, or hydration. It has no general hook API, memo wrapper, synthetic events, or devtools ownership. Build-time expressive-jsx extraction is not included.
