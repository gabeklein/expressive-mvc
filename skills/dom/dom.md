# DOM renderer

`@expressive/dom` renders MVC components directly to browser DOM. It has no React or Preact dependency.

## Status

The initial `0.1` release is a usable, tested browser renderer for dogfooding, not an LTS contract. Use it for applications prepared to track pre-1.0 changes. The documented behavior is intentional; package shape and extension seams may change before stabilization. Renderer internals are private—import only the package root and its JSX runtime entries.

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/dom"
  }
}
```

```tsx
import { State, Component, pending } from '@expressive/mvc';
import { Provider, createPortal, lazy, render } from '@expressive/dom';
```

## Render

`render(node, container)` replaces an existing root in the container and returns an idempotent unmount function.

```tsx
const unmount = render(<App />, document.getElementById('app')!);
unmount();
```

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

Register immutable maps with `style(Component, map)`; `macro(map)` registers global ones. A `_name` entry is a **rule** - a static block. Bare keys are declarations, or **macro** calls where a macro owns the name.

```tsx
function Button({ active }: { active: boolean }) {
  return <button _active={active}>Save</button>;
}

macro({
  mx: (value: unknown) => ({ marginLeft: `${value}px`, marginRight: `${value}px` })
});

style(Button, {
  padding: '8px',
  _active: { fontWeight: 700 },
  _raised: { mx: 4, boxShadow: '0 1px 2px black' }
});
```

- A rule applies when `_name` is truthy on an element, or when the element's host tag is `name`. `0` and `''` do not activate - a rule is on or off, while a macro still treats `0` as a value. Each applied rule is one class named after its source, such as `Button_active`. Nested inside a rule body, `_name` opens a descendant scope.
- Bare keys at the top of a map form a **base rule** applied to each of the component's host roots - `padding` above styles every root `Button` renders, through fragments.
- A map never reaches inside a child component. Rules, base declarations and tag matches apply to the elements that component renders; a descendant scope handed to a child through `style` covers that child's own output and stops there. Only the class chain inherits - `Derived` sees `Base`'s rules.
- Component names never match; minifiers rename them. A caller styles a child through `_rule` on the component element, which travels by door.
- `$name` is reserved for host instructions and throws.
- `false`, `null`, and `undefined` omit an entry; `0` is a value. `_` attributes are style-only and never reach the DOM.

Macros are defined only by `macro()`. A function inside a `style()` map is a value, not a definition - rules are static, so call a plain function in place. A key resolves at its topmost definition; a macro returning its own name falls to the next definition down, then through any `'*'` handler, then to the host. The host joins arrays with spaces, rejects a function or object (`No macro handles "mx"`), and never adds units - a macro owns them, so write `padding: '8px'`, not `padding: 8`.

Repeated `style()` calls add layers and return the component unchanged. Within a scope, globals come first, then base class, derived class, and registration order. A component's registrations close at *its* first render - a lazily loaded module may still call `style()` later for a component that has not rendered. `macro()` is global and closes at the first render of anything.

Inline style always beats classes. Among classes, a caller's rule beats the callee's: a `_rule` on a component element travels as a token through `style`, and each component `style` prop crossed - forwarded or handed on explicitly - adds a door. More doors wins - for classes and for which nested rules reach descendants - independent of render or emission order. Blocks emitted past the first door carry a `-dN` suffix.

Build-time extraction is not part of the `0.1` experiment.

### The web pack

`css` is a macro pack shipped with the renderer. Registering it opts into pixel units for numbers and the axis shorthands CSS lacks:

```ts
import { css, macro } from '@expressive/dom';

macro(css);
```

A number gets `px` only where the CSSOM rejects a bare one - probed once per property, so `zIndex: 3`, `lineHeight: 1.5` and `fontWeight: 700` stay unitless while `paddingTop: 5` and `marginBlockEnd: 2` do not. Every entry of a sequence is sized, so `margin: [1, 2]` is `1px 2px`. `mx` / `my` / `px` / `py` set an axis, and `size` sets width and height.

Without the pack the terminal never guesses: a rule needs `padding: '8px'`, and a bare number reaches CSS unchanged.

### Typing

Maps are typed: a bare key must be a CSS property or a macro declared in `macro.Registry`, `_name` opens a rule, and anything else is rejected - `colr` reports *Did you mean 'color'?* rather than throwing at the terminal. A bare key never takes an object, which is what separates `margin: '0 8px'` from `_margin: { ... }`.

A pack declares what it registers:

```ts
declare module '@expressive/dom' {
  namespace macro {
    interface Registry {
      mx(value: number): style.Map;
    }
  }
}

macro({ mx: (value: number) => ({ marginLeft: `${value}px`, marginRight: `${value}px` }) });
```

Declaration merging is whole-program, so the augmentation may sit anywhere - above the registration, below it, or in another module. A declared name is checked where it registers *and* where it is called; an undeclared one still registers, but a typed map cannot call it. With no pack at all, CSS properties, rules and `--variables` work as they are.

`className` is element-only. `style` on a component forwards through component and transparent boundaries to its host root; fragment output applies it to every host root. Reading `style` during render - destructuring, a spread, `this.props.style`, or a declared `style` field on a Component - takes ownership and suppresses forwarding for that render. Forwarded style overrides the root's own, and the outermost caller wins; a component wanting the last word consumes `style` and places it first:

```tsx
function Field({ style }: { style?: JSX.IntrinsicElements['div']['style'] }) {
  return <label><input style={['field', style]} /></label>;
}

<Field style={['invalid', { color: 'red' }]} />;
```

A component reading `style` receives a frozen object, or `undefined` when nothing was passed. Its own keys are the caller's inline declarations, flattened in written order; classes travel hidden with it. Override with a spread (`{ ...style, color: 'blue' }`), drop a key with rest (`const { width, ...rest } = style`), or merge two with `{ ...a, ...b }` - classes survive all three. Combine style values with arrays (`[a, b, 'local']`); spread to edit declarations. Do not branch on its shape, and do not clone it - `structuredClone` and JSON drop the classes.

## MVC render scopes

FCs have no renderer-owned state cells or effects. Treat them as pre-hooks stateless components whose MVC reads declare a dependency snapshot:

```tsx
function Total() {
  const { total, checkout } = Cart.get();
  return <button onClick={checkout}>{total}</button>;
}
```

`State.get()` works in an FC, `Component.render()`, or a PascalCase subcomponent. Only values read through the returned tracking proxy invalidate that scope; same-value writes and unrelated fields do not render it.

`State.use()` creates an MVC-owned State in an FC slot. Calls must remain top-level and in stable order. The instance persists across renders, receives `use(...args)` each render when defined, runs `mount()` after its first DOM commit, and is destroyed on unmount. `State.use()` in `Component.render()` is an error—put owned state on the Component as a field.

```tsx
class Selection extends State {
  selected = '';

  use(selected: string) {
    this.selected = selected;
  }
}

function Row({ id }: { id: string }) {
  const { selected } = Selection.use(id);
  return <span>{selected}</span>;
}
```

`Provider`, `Consumer`, implicit Component context, and context through portals use MVC `Context`; no renderer context API is exposed.

## Lazy, boundaries, transitions

`lazy(loader)` accepts a module default export or a directly exported component. A Component supplies a suspense boundary unless `fallback = false`; `Provider fallback={...}` adds one explicitly. A suspension or caught error anywhere below replaces the whole boundary with one fallback; its content stays mounted off-document, keeps updating, and reveals at once when every waiting scope renders. `Component.catch(error)` handles render failures and retries after it completes; until then the boundary holds its fallback, even if state written inside `catch()` would render cleanly. A rejected `catch()` escalates to the next boundary, which holds likewise. Handled errors are not logged. A boundary nested in a hidden one keeps its own state - an inner fallback still showing when the outer hides is still showing when it reveals.

```tsx
const Settings = lazy(() => import('./Settings'));

class App extends Component {
  fallback = <p>Loading…</p>;

  render() {
    return <Settings />;
  }
}
```

MVC `pending(work)` runs `work` inline and defers subscriber DOM work. If the replacement suspends, the committed range remains until it can complete; an urgent suspension shows its fallback. Its promise resolves after the replacement commits or the affected scope unmounts. Scopes one transition updates commit together: if one suspends in its own render, or below a scope that currently renders nothing, none commit until it resolves - a route swap holds the outgoing page, and a guarded child does not render past its suspended guard. A suspension found deeper, inside content a scope already shows, retains that scope's range only: scopes of the transition already patched keep their update, as do siblings patched before the suspending child.

`Component.catch` retries once after it completes; a render that fails again keeps the fallback until state it read changes. A portal inside a hidden boundary is hidden with it; one first mounted while the boundary is hidden appears immediately.

```tsx
await pending(() => {
  router.page = 'settings';
});
```

## Portals

`createPortal(children, container, key?)` renders into another `Element` or `DocumentFragment` while retaining logical MVC context and ownership.

```tsx
return createPortal(<Dialog />, document.body);
```

## Boundaries

The renderer is browser-only: no native target, SSR, or hydration. It has no general hook API, memo wrapper, synthetic events, or devtools ownership. Build-time expressive-jsx extraction is not included.
