<h1 align="center">@expressive/dom</h1>

<p align="center">
  MVC-native JSX rendering for the browser DOM.
</p>

---

`@expressive/dom` renders Expressive MVC without React or Preact. Function components are renderer-stateless: they project props and MVC snapshots into DOM, while `State.get()` and `State.use()` supply dependency tracking and owned state.

```bash
npm install @expressive/dom
```

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/dom"
  }
}
```

```tsx
import State, { Component, render } from '@expressive/dom';

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

See [the DOM adapter guide](../../skills/dom/dom.md) for the API and constraints.

## License

MIT
