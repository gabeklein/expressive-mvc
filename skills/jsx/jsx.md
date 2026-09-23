# JSX renderer

`@expressive/jsx` renders MVC components directly to browser DOM. It has no React or Preact dependency.

## Status

The initial `0.1` release is a usable, tested browser renderer for dogfooding, not an LTS contract. Use it for applications prepared to track pre-1.0 changes. The documented behavior is intentional; package shape and extension seams may change before stabilization. Renderer internals are private—import only the package root and its JSX runtime entries.

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/jsx"
  }
}
```

```tsx
import State, {
  Component,
  Provider,
  createPortal,
  lazy,
  pending,
  render
} from '@expressive/jsx';
```

## Render

`render(node, container)` replaces an existing root in the container and returns an idempotent unmount function.

```tsx
const unmount = render(<App />, document.getElementById('app')!);
unmount();
```

Supported output: intrinsic HTML/SVG elements, fragments, strings/numbers/bigints, FCs, `Component` classes and instances, `has.List` / `has.Pool`, `map.Managed`, portals, arrays, and empty boolean/null/undefined values. Keys preserve DOM ranges across reorder.

Events are native `addEventListener` listeners (`onClick`, `onKeyDown`, `onClickCapture`) with native event objects and propagation. There is no synthetic event layer: `onChange` on a text field fires on commit - use `onInput` per keystroke.

`value` and `checked` apply after children and other props and are compared with the live element on every render, so `<select value>`, range bounds, and bound inputs follow state. A handler that rejects input without changing state leaves the typed value until the next render - set `event.currentTarget.value` to revert immediately. `class`, `style`, `dangerouslySetInnerHTML`, callback/object refs, DOM properties, `data-*`, and `aria-*` are supported.

## Styles

`style` recursively flattens arrays. Falsy entries are ignored, strings become DOM class tokens, and objects merge left-to-right into inline declarations. The inline result follows the browser cascade and normally overrides class rules. Use `class` for an external browser-only class; it is prepended to classes from `style`.

```tsx
<button
  class="external-widget"
  style={[
    'button',
    active && 'active',
    [compact && 'compact', { width }]
  ]}
/>
```

`className` is ignored, including through untyped spreads. A string in `style` is a class token, not CSS declaration text. Treat arrays and objects as immutable render values—replace them when their contents change.

### Component appearance rules

Register immutable maps with `style(Component, map)`; `macro(map)` registers global ones. An object entry is a **rule** - a static block. A function entry is a **macro** - it maps an argument to style.

```tsx
function Button({ active, color }: { active: boolean; color: string }) {
  return <button _active={active} _color={color}>Save</button>;
}

style(Button, {
  button: { padding: 8 },
  active: { fontWeight: 700 },
  color: (value: unknown) => ({ color: value }),
  raised: { mx: 4, boxShadow: '0 1px 2px black' },
  mx: (value: unknown) => ({ marginLeft: value, marginRight: value })
});
```

- A rule applies when its key matches a host tag or child component name in scope, or when `_rule` is truthy. Each applied rule is one class named after its source, such as `Button_active`.
- A macro expands wherever its key appears: in a rule body (`raised: { mx: 4 }`) or as `_macro={value}` on an element. A macro never expands into itself, so `color` inside `color`'s output is plain CSS. A defined macro shadows a CSS property of the same name.
- An element's macro calls form its **location rule**, one class per site (`Button_button-color`). At runtime a site is a tag plus its `_` attribute names within one scope, so same-shaped elements share it. When a value differs, only the differing properties move inline; the rest keep the class.
- Nested objects under a non-CSS key open descendant scopes.
- `false`, `null`, and `undefined` omit an entry; `0` is a value. `_` attributes are style-only and never reach the DOM.

Repeated `style()` calls add layers and return the component unchanged. Within a scope, globals come first, then base class, derived class, and registration order. Register before the component first renders; register all macros before the first render after any macro is installed.

Inline style always beats classes. Among classes, a caller's rule beats the callee's: component-name rules and `_rule`s on a component element travel as tokens through `style`, and each component `style` prop crossed - forwarded or handed on explicitly - adds a door. More doors wins, independent of render or emission order. Blocks emitted past the first door carry a `-dN` suffix.

Keep each JSX location's `_` attribute names stable; a `_` key added later through a dynamic spread is not detected. Build-time extraction is not part of the `0.1` experiment.

A component-name rule matches `displayName`, else the function or class name - set `displayName` or keep names (`keepNames`, `keep_fnames`/`keep_classnames`) when minifying.

`class` is element-only. `style` on a component forwards through component and transparent boundaries to its host root; fragment output applies it to every host root. Reading `style` during render - destructuring, a spread, `this.props.style`, or a declared `style` field on a Component - takes ownership and suppresses forwarding for that render. Forwarded style overrides the root's own, and the outermost caller wins; a component wanting the last word consumes `style` and places it first:

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

`lazy(loader)` accepts a module default export or a directly exported component. A Component supplies a suspense boundary unless `fallback = false`; `Provider fallback={...}` adds one explicitly. A suspension or caught error anywhere below replaces the whole boundary with one fallback; its content stays mounted off-document, keeps updating, and reveals at once when every waiting scope renders. `Component.catch(error)` handles render failures and retries after it completes.

```tsx
const Settings = lazy(() => import('./Settings'));

class App extends Component {
  fallback = <p>Loading…</p>;

  render() {
    return <Settings />;
  }
}
```

MVC `pending(work)` runs `work` inline and defers subscriber DOM work. If the replacement suspends, the committed range remains until it can complete; an urgent suspension shows its fallback. Its promise resolves after the replacement commits or the affected scope unmounts. Retention is per scope: siblings patched before the suspending child keep their update.

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
