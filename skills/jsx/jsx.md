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

Events are native `addEventListener` listeners (`onClick`, `onClickCapture`) with native event objects and propagation. There is no synthetic event layer. `className`, `class`, `style`, `dangerouslySetInnerHTML`, callback/object refs, DOM properties, `data-*`, and `aria-*` are supported.

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

`lazy(loader)` accepts a module default export or a directly exported component. A Component supplies a suspense boundary unless `fallback = false`; `Provider fallback={...}` adds one explicitly. `Component.catch(error)` handles render failures and retries after it completes.

```tsx
const Settings = lazy(() => import('./Settings'));

class App extends Component {
  fallback = <p>Loading…</p>;

  render() {
    return <Settings />;
  }
}
```

MVC `pending(work)` runs `work` inline and defers subscriber DOM work. If the replacement suspends, the committed range remains until it can complete; an urgent suspension shows its fallback. Its promise resolves after the replacement commits or the affected scope unmounts.

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

The renderer is browser-only: no native target, SSR, or hydration. It has no general hook API, memo wrapper, synthetic events, devtools ownership, or CSS-in-JS runtime. Ordinary classes/styles work now; the expressive-jsx label-based styling compiler is not included.
