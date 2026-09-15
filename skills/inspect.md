# Inspect

`@expressive/inspect` - in-page inspector over live State. Registry, ownership tree, path queries, writes, and a frame journal. No UI, no network. Consumers: agents through a browser tool or Playwright `evaluate`, devtools, test helpers.

## Install

```ts
// first import of the app entry, before any State is constructed
import '@expressive/inspect/install';
```

Attaches to `State` from the same `@expressive/mvc` instance and publishes `globalThis.__EXPRESSIVE_INSPECT__`. Instances constructed before the import are invisible. A script outside the app's module graph (userscript, Playwright init script) imports a different `State` and sees nothing - it must reach the app's global instead.

Programmatic: `import { attach } from '@expressive/inspect'; attach(State)` - returns detach. `attach(Sub)` scopes to a subclass.

## Address

`Type.path.to.field` or `Type-id.path` - `Type` is the class name (first live instance), `Type-id` is the id from `models()` (`String(state)`). Path steps through child States, `Map`s, arrays, and objects.

## Read

```ts
inspect.models()          // [{ id, type, parent?, keys, absent }]
inspect.tree()            // [{ id, type, children }] nested by ownership
inspect.get('Composer')   // { $ref, $type, ...stored values }
inspect.get('Composer.draft')
```

Reads come from stored values, never through accessors - no getter, factory, or suspense fires. `absent` lists declared keys with no stored value: lazy `set(factory)`, pending async, uncomputed getters. Nested States serialize to `{ $ref, $type }`; strings cap at 240 chars, arrays at 24, keys at 40, depth at 2. Query, do not dump.

Ownership: a State stored in another State's field, `has` pool, or `map` is that owner's child. First owner wins.

## Write

```ts
inspect.set('Composer.draft', 'hello')      // assignment through the accessor
await inspect.call('Composer.submit', arg)  // method; result serialized
```

## Journal

Off by default. Nothing is retained until asked.

```ts
inspect.journal.record({ level: 'keys' })                 // keys only
inspect.journal.record({ level: 'values', calls: true })  // values and method calls
inspect.journal.record({ level: 'keys', types: ['Composer'] })
inspect.journal.frames({ since, type, id, key })
inspect.journal.history({ id, key })       // flat [{ seq, at, event }]
inspect.journal.clear()
```

A frame is one synchronous batch of writes plus its microtask flush - the unit React commits. Writes made by effects land in the next frame. Events: `update` (stored key), `event` (custom dispatch), `call` (method, `render` excluded), `destroy`. Retains 500 frames.

## Playwright

```ts
const draft = await page.evaluate(() => __EXPRESSIVE_INSPECT__.get('Composer.draft'));
```

Drive input through the UI; assert on the model. Reserve DOM assertions for presentation the model does not express.
