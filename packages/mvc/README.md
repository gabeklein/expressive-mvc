<h1 align="center">@expressive/mvc</h1>

<p align="center">
  Class-based reactive state management - framework-agnostic core.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/mvc"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Fmvc.svg"></a>
  <img src="https://img.shields.io/badge/Coverage-100%25-brightgreen.svg">
</p>

---

The core of [Expressive MVC](https://github.com/gabeklein/expressive-mvc): reactive primitives built around plain classes, with no framework dependency. Provides the `State` model, the renderer-agnostic `Component`, and the JSX runtime that adapters like [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) build on.

```bash
npm install @expressive/mvc
```

```ts
import { State } from '@expressive/mvc';

class Counter extends State {
  count = 0;
  increment = () => this.count++;
}

const counter = Counter.new();

// effect runs now ("count is 0"), then again whenever `count` changes
counter.get(({ count }) => console.log(`count is ${count}`));

counter.increment(); // -> "count is 1"
```

**At a glance**

- **Class-based** - state is a class; fields are reactive, getters are computed.
- **Fine-grained** - reads subscribe, writes notify; only what changed reacts.
- **Headless** - models run and test anywhere, no renderer required.
- **Instructions** - `ref` / `set` / `get` / `hot` shape fields (refs, computed, context injection, reactive collections).
- **Agnostic `Component`** - a `State` that renders, with a host adapter supplying the framework.

**Computed & instructions**

Getters are cached computed values; `set` / `get` / `ref` / `hot` shape how fields behave.

```ts
import { State, get, set, hot } from '@expressive/mvc';

class Cart extends State {
  items = hot<Item[]>([]);               // shallow-reactive collection
  coupon = set('', code => apply(code)); // assignment side-effect

  get total() {                          // recomputes only when items change
    return this.items.reduce((n, i) => n + i.price, 0);
  }
}

class Checkout extends State {
  cart = get(Cart);                      // injected from context
}
```

To render in a UI framework, add an adapter: [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) or `@expressive/preact`.

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
