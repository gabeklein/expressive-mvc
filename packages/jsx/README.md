<h1 align="center">@expressive/jsx</h1>

<p align="center">
  MVC-native JSX rendering for the browser DOM.
</p>

---

`@expressive/jsx` renders Expressive MVC without React or Preact. Function components are renderer-stateless: they project props and MVC snapshots into DOM, while `State.get()` and `State.use()` supply dependency tracking and owned state.

```bash
npm install @expressive/jsx
```

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/jsx"
  }
}
```

```tsx
import State, { Component, render } from '@expressive/jsx';

class Counter extends State {
  count = 0;
  increment() {
    this.count++;
  }
}

function Count() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}

const unmount = render(<Count />, document.getElementById('app')!);
```

`style` recursively composes conditional class tokens and inline declarations. Strings become classes; objects merge left-to-right and render inline. Use `class` for a browser-specific class outside the composition. `className` and CSS declaration strings are not supported.

```tsx
<button
  class="external-widget"
  style={[styles.button, active && 'active', { width }]}
/>
```

`style` on a component automatically reaches its rendered host root, including through component, fragment, provider, portal, and collection boundaries. A fragment applies it to each host root. Forwarded style overrides the root's own, with the outermost caller winning. A component which reads its `style` prop while rendering owns placement, and nothing is forwarded. It receives a frozen object of the caller's inline declarations - spread, pluck or merge it freely; the caller's classes travel hidden with it. `class` applies to elements only.

A component may register immutable rule maps with `style(Component, rules)`. Repeated calls add layers. Tag/component-name rules apply automatically; `_rule` attributes activate object rules or pass a value to pure macro functions. These attributes never reach the DOM.

```tsx
function Button({ active, color }: { active: boolean; color: string }) {
  return <button _active={active} _color={color}>Save</button>;
}

style(Button, {
  button: { padding: 8 },
  active: { fontWeight: 700 },
  color: (value: unknown) => ({ color: value })
});
```

Global maps use `macro(rules)` and can live in side-effect imports. Register macros and styles before the first relevant render. Order is deterministic: globals, base classes, derived classes, repeated calls, then explicit element `style`; later properties win. Serializable combinations become generated CSS classes on first use. Each structural route caches up to 8 combinations, then resolves new high-cardinality values inline. `false`, `null`, and `undefined` omit a rule; `0` remains a macro argument.

`Component` retains the React adapter's model: fields read by `render()` are dependencies, owned instances mount and clean up with the DOM range, and an externally activated instance can be placed directly without transferring ownership.

The first release includes keyed reconciliation, native events, refs, SVG, `Provider` / `Consumer`, direct `has` / `map` collection rendering, portals, lazy components, error and suspense fallbacks, generated component appearance rules, and retention of committed content while `pending()` work suspends. It deliberately excludes standalone hooks, synthetic events, memo wrappers, SSR, hydration, and build-time style extraction.

See [the JSX renderer guide](../../skills/jsx/jsx.md) for the API and constraints. This package currently targets browser DOM; native rendering and build-time expressive-jsx extraction are not included.

## License

MIT
