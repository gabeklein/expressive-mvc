<h1 align="center">@expressive/preact</h1>

<p align="center">
  Preact adapter for Expressive MVC - class-based reactive state.
</p>

---

The Preact adapter for [Expressive MVC](https://github.com/gabeklein/expressive-mvc). It mirrors the [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) API - `State.use()`, `State.get()`, `Component`, `Provider` / `Consumer` - against a Preact host.

> **Note:** This package is currently internal and not published to npm. It is kept in parity with the React adapter; track [the repo](https://github.com/gabeklein/expressive-mvc) for availability.

```tsx
import { State } from '@expressive/preact';

class Counter extends State {
  count = 0;
  increment = () => this.count++;
}

function CounterWidget() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}
```

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
