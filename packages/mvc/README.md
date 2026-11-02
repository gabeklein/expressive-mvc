<h1 align="center">@expressive/mvc</h1>

<p align="center">
  Class-based reactive state management - framework-agnostic core.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/mvc"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Fmvc.svg"></a>
  <a href="https://github.com/gabeklein/expressive-mvc/actions/workflows/coverage.yml"><img alt="Coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fgabeklein%2Fexpressive-mvc%2Fbadges%2Fcoverage.json"></a>
</p>

---

The core of [Expressive MVC](https://github.com/gabeklein/expressive-mvc): reactive primitives built around plain classes, with no framework dependency. Provides the `Model` class, instructions, context, and the renderer-agnostic `Component` that adapters like [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) build on.

> **Building a React app?** Install [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) alongside this package - the adapter declares `@expressive/mvc` as a peer dependency, so both belong in your `package.json`. Import `Model`, `Component`, and every instruction from this package, and import the adapter once from your entry so the host registers. The same holds for [`@expressive/dom`](https://www.npmjs.com/package/@expressive/dom), the renderer without React.

Installed alone, it serves host-agnostic code - a shared domain package, a Node service, or a new adapter:

```bash
npm install @expressive/mvc
```

## Model

A `Model` is a class whose fields are reactive - read to subscribe, assign to update. Getters are cached computed values.

```ts
import { Model } from '@expressive/mvc';

class Counter extends Model {
  count = 0;
  increment() {
    this.count++;
  }

  get doubled() {
    return this.count * 2;     // recomputes only when count changes
  }
}

const counter = Counter.new();

// effect runs now, then again whenever read values change
counter.get(({ count }) => {
  console.log(`count is ${count}`);
});

counter.increment();           // -> "count is 1"
```

Instances run and test anywhere - no renderer required.

## Instructions

Field initializers that change how a property behaves:

| | |
|---|---|
| `ref()` | a mutable reference (e.g. a DOM node) that's still reactive |
| `set()` | computed values, smart setters, side-effects on assignment |
| `get()` | dependency injection - pull another `Model` from context |
| `map()` | a shallow-reactive Map |
| `has()` | an owned reactive collection - an ordered list or a spawned pool |

```ts
import { Model, set, has, map } from '@expressive/mvc';

class Cart extends Model {
  items = has<Item>();                      // reactive collection
  products = map<string, Product>();        // reactive keyed collection
  coupon = set('', code => apply(code));    // side-effect on assignment
}
```

## Lifecycle

```ts
class Timer extends Model {
  seconds = 0;

  new() {                              // runs once on activation
    const id = setInterval(() => this.seconds++, 1000);
    return () => clearInterval(id);    // returned cleanup runs on destroy
  }
}

const timer = Timer.new();   // construct + activate
timer.set(null);             // destroy - runs cleanup, freezes state
```

Under a host that renders on the server, `new()` still runs there but its cleanup never does - so client resources like this interval go in `mount()` instead, which runs only on the client; see the host's docs.

## Context & composition

Instances find each other through context, and compose by holding one another:

```ts
import { Model, get } from '@expressive/mvc';

class Session extends Model {
  user = 'guest';
}

class Profile extends Model {
  session = get(Session);    // injected from the nearest provider
  address = new Address();   // nested instance - its changes bubble up
}
```

`<Component for={Model}>` - part of this package - places a `Model` in a tree; a host such as [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) renders it, and `get()` pulls the instance back out.

## Events

Any property or arbitrary key can be dispatched and listened to:

```ts
const off = counter.set('refresh', () => reload());   // listen
counter.set('refresh');                               // dispatch
off();                                                // stop listening
```

## Framework-agnostic components

`@expressive/mvc` ships its own JSX runtime, so you can author components - including reusable libraries - against the core and let any host render them:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@expressive/mvc"
  }
}
```

`Component` - a `Model` usable in JSX - lives here, along with `<Component for>`: props, subcomponents, suspense and context placement are all core. A host only renders them; for how that looks in an app, see **[`@expressive/react`](https://www.npmjs.com/package/@expressive/react)**.

---

To render state in a UI, add a host: [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) or [`@expressive/dom`](https://www.npmjs.com/package/@expressive/dom).

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
