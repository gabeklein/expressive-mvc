# Inspect

`@expressive/inspect` - in-process inspector over live State. Registry, ownership, path reads, a frame journal with causality. No UI, no network. The base layer for agents (via a browser tool or Playwright `evaluate`), devtools, and test helpers.

## Install

```ts
// first import of the app entry, before any State is constructed
import '@expressive/inspect/install';
```

Attaches to `State` from the same `@expressive/mvc` instance and publishes `globalThis.__EXPRESSIVE_INSPECT__`. Instances constructed before the import are invisible. A script outside the app's module graph (userscript, Playwright init script) imports a different `State` and sees nothing - reach the app's global instead.

Programmatic: `attach(State)` returns detach; `attach(Sub)` scopes to a subclass.

## Two faces, one id

In process you get **handles**. Across a serializing boundary (`evaluate`, `postMessage`, socket) you use **addresses**. Both key on the same ids: `String(state)`, e.g. `Composer-x1s4`.

## Handles (in process)

```ts
import { find, roots, handles } from '@expressive/inspect';

const app = roots()[0];              // handles with no owner
const composer = find('Composer');   // by label, or find('Composer-x1s4') by id
composer.state                       // the raw instance - assign to it directly
composer.parent / composer.children  // ownership
app.find('Composer')                 // depth-first by label or predicate
composer.get('draft')                // stored value, serialized
composer.model()                     // { id, typeId, type, site?, parent?, keys, absent }
composer.watch((key) => ..., ['draft'])   // unsubscribe returned
composer.frames({ since })           // this instance's journal
await composer.act((s) => s.submit('x'))  // run, settle, return frames produced
```

Ownership: a State stored in another State's field, `has` pool, or `map` is that owner's child. First owner wins.

`act` records for its window even when the journal is off, and returns every frame produced, including downstream ones.

## Addresses (across a boundary)

`Type.path` or `Type-id.path`. `Type` is the label (first live instance); path steps through child States, `Map`s, arrays, objects.

```ts
inspect.models()                 // flat list with parent ids
inspect.tree()                   // nested { id, type, children }
inspect.get('Composer.draft')
inspect.set('Composer.draft', 'x')
await inspect.call('Composer.submit', 'x')
```

Reads come from stored values, never through accessors - no getter, factory, or suspense fires. `absent` lists declared keys with no stored value: lazy `set(factory)`, pending async, uncomputed getters. Nested States serialize to `{ $ref, $type }`; strings cap at 240 chars, arrays 24, keys 40, depth 2. Query, do not dump.

## Labels and minified builds

Minifiers keep property names and mangle class names, so keys survive production and `constructor.name` does not. Each class gets an opaque `typeId` at first sight and a `site` (construction stack) for a resolver. Label resolution: `label(Type, name)` or `static displayName`, then a table from `resolve({ [typeId | site]: name })`, then the class name when longer than two characters, else `typeId`.

For builds an agent or devtool will touch, keep class names: esbuild `keepNames`, terser `keep_classnames`. Property mangling is unsupported.

## Journal

Off by default. Nothing is retained until asked.

```ts
journal.record({ level: 'keys' })                  // keys only
journal.record({ level: 'values', calls: true })   // values and method calls
journal.record({ level: 'keys', types: ['Composer'] })
journal.frames({ since, type, id, key, cause })
journal.history({ id, key })       // flat [{ seq, at, event }]
journal.downstream(seq)            // frames reachable through cause
journal.seq()                      // pass back as since
journal.export({ since })          // NDJSON, one event per line
journal.clear()
```

A frame is one synchronous batch of writes plus its flush, including writes effects make synchronously during it - the unit React commits. Work an effect defers to a later microtask opens a new frame with `cause` set to the frame that scheduled it; work deferred to a macrotask starts a new root. Events: `update` (stored key), `event` (custom dispatch), `call` (method, `render` excluded), `destroy`. Retains 500 frames.

Bulk analysis belongs outside the page: `export` to a sidecar and query there.

## Playwright

```ts
const draft = await page.evaluate(() => __EXPRESSIVE_INSPECT__.get('Composer.draft'));
const since = await page.evaluate(() => __EXPRESSIVE_INSPECT__.journal.seq());
await page.click('#submit');
const frames = await page.evaluate((s) => __EXPRESSIVE_INSPECT__.journal.frames({ since: s }), since);
```

Drive input through the UI; assert on the model. Reserve DOM assertions for presentation the model does not express.
