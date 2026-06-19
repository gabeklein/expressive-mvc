<h1 align="center">@expressive/mvc</h1>

<p align="center">
  Class-based reactive state management - framework-agnostic core.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/mvc"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Fmvc.svg"></a>
  <img src="https://img.shields.io/badge/Coverage-100%25-brightgreen.svg">
</p>

---

The core of [Expressive MVC](https://github.com/gabeklein/expressive-mvc): reactive primitives built around plain classes, with no framework dependency. Provides the `State` model, instructions, context, and the renderer-agnostic `Component` that adapters like [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) build on.

```bash
npm install @expressive/mvc
```

## State

A `State` is a class whose fields are reactive - read to subscribe, assign to update. Getters are cached computed values.

```ts
import { State } from '@expressive/mvc';

class Counter extends State {
  count = 0;
  increment = () => this.count++;

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

Models run and test anywhere - no renderer required.

## Instructions

Field initializers that change how a property behaves:

| | |
|---|---|
| `ref()` | a mutable reference (e.g. a DOM node) that's still reactive |
| `set()` | computed values, smart setters, side-effects on assignment |
| `get()` | dependency injection - pull another `State` from context |
| `hot()` | a shallow-reactive array or object |

```ts
import { State, set, hot } from '@expressive/mvc';

class Cart extends State {
  items = hot<Item[]>([]);                  // reactive collection
  coupon = set('', code => apply(code));    // side-effect on assignment
}
```

## Lifecycle

```ts
class Timer extends State {
  seconds = 0;

  new() {                              // runs once on activation
    const id = setInterval(() => this.seconds++, 1000);
    return () => clearInterval(id);    // returned cleanup runs on destroy
  }
}

const timer = Timer.new();   // construct + activate
timer.set(null);             // destroy - runs cleanup, freezes state
```

## Context & composition

States find each other through context, and compose by holding one another:

```ts
import { State, get } from '@expressive/mvc';

class Session extends State {
  user = 'guest';
}

class Profile extends State {
  session = get(Session);    // injected from the nearest provider
  address = new Address();   // nested state - its changes bubble up
}
```

An adapter (e.g. [`@expressive/react`](https://www.npmjs.com/package/@expressive/react)) supplies the provider that places a `State` in a tree; `get()` pulls it back out.

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

`Component` - a `State` that renders - lives here as the agnostic base. For using it in an app (rendering, props, subcomponents, suspense), see **[`@expressive/react`](https://www.npmjs.com/package/@expressive/react)**.

---

To render state in a UI framework, add an adapter: [`@expressive/react`](https://www.npmjs.com/package/@expressive/react) or `@expressive/preact`.

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
