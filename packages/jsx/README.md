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

`Component` retains the React adapter's model: fields read by `render()` are dependencies, owned instances mount and clean up with the DOM range, and an externally activated instance can be placed directly without transferring ownership.

The first release includes keyed reconciliation, native events, refs, SVG, `Provider` / `Consumer`, direct `has` / `map` collection rendering, portals, lazy components, error and suspense fallbacks, and retention of committed content while `pending()` work suspends. It deliberately excludes standalone hooks, synthetic events, memo wrappers, SSR, hydration, and a styling runtime.

See [the JSX renderer guide](../../skills/jsx/jsx.md) for the API and constraints. This package currently targets browser DOM; native rendering and the expressive-jsx styling compiler are not included.

Alternate hosts can reuse the state and render-scope lifecycle from `@expressive/jsx/adapter` without registering browser element mechanics. Applications import their host package rather than this implementation entry.

## License

MIT
