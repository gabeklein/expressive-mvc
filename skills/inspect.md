# Inspect

`@expressive/inspect` - in-process inspector over live State: registry, ownership, path reads, a frame journal with causality. No UI; network only through the dev-server relay ([Vite](#vite)). Base layer for agents (via a browser tool or a driver's `evaluate`), devtools, and test helpers.

## Install

```ts
// first import of the app entry, before any State is constructed
import '@expressive/inspect/install';
```

Attaches to `State` from the same `@expressive/mvc` instance and publishes `globalThis.__EXPRESSIVE_INSPECT__` (typed on `globalThis`). Instances constructed before the import are invisible. Install ships in the app bundle - a Playwright `addInitScript` or userscript imports a different `State` and sees nothing. Gate it yourself: side-effect import for a harness, `attach()` behind a dev flag for a shipped build.

Programmatic: `attach(State)` returns detach; `attach(Sub)` scopes to a subclass.

Under Vite, the plugin installs it - see [Vite](#vite).

## Two faces, one id

In process you get **instances**; across a serializing boundary (`evaluate`, `postMessage`, socket) you use **addresses**. Both key on the same id: `String(state)`, e.g. `Composer-x1s4`.

## Instances (in process)

```ts
import { find, roots, instances } from '@expressive/inspect';

const app = roots()[0];              // instances with no owner
const composer = find('Composer');   // by label, or find('Composer-x1s4') by id
composer.state                       // the raw instance - assign to it directly
composer.alive / since / until       // registry span (ms); an Instance outlives its state
composer.parent / composer.children  // ownership, memoized until the registry changes
app.find('Composer')                 // depth-first by label or predicate
composer.get('draft')                // stored value, serialized
composer.model()                     // { id, typeId, type, site?, parent?, keys, absent }
composer.watch((key) => ..., ['draft'])   // key per update, null on destroy; unsubscribe returned
composer.frames({ since })           // this instance's journal
await composer.act((s) => s.submit('x'))  // run, settle, return frames produced
```

Ownership: a State in a plain field, `has` pool, or `map` is that owner's child; a `get(Type)` reference is not. First owner wins. One `Instance` per state - `find` returns the same object each time; a held reference keeps working after destruction, with `alive` false and `until` set.

`act` records for its window even with the journal off, and returns every frame produced, downstream ones included.

## Orphans

Under a host adapter, an activated instance is **claimed** by a host commit (`mount`), by a claimed owner, or by holding its `static global` slot in the root context. One settled but unclaimed - a render React threw away, a StrictMode twin, a `State.new()` nobody placed - is an orphan; so are its children. Orphans stay out of `models()`, `tree()`, `instances()`, `roots()`; label lookups resolve mainline first. `orphans()` lists them; `warnings()` counts them plus unclaimed instances the collector already reaped. Without a host every instance is mainline.

```ts
inspect.warnings()                  // { orphans: 54, collected: 0 } - a suspended first render left a full tree behind
inspect.orphans().map((o) => o.type)
instance.claimed
```

Unclaimed instances are held weakly - the inspector never pins an abandoned render in memory. A rising `collected` with no `destroy` events is a leak the host cleaned up for you.

## Addresses (across a boundary)

`Type.path` or `Type-id.path`. `Type` is the label (first live instance); the path steps through child States, `Map`s, arrays, objects.

```ts
inspect.models()                 // flat list with parent ids
inspect.tree()                   // nested { id, type, children }
inspect.get('Composer.draft')
inspect.set('Composer.draft', 'x')
await inspect.call('Composer.submit', 'x')
```

Reads come from stored values, never accessors - no getter, factory, or suspense fires. `absent` lists declared keys with no stored value: lazy `set(factory)`, pending async, uncomputed getters. Nested States serialize to `{ $ref, $type }`; caps: strings 240 chars, arrays 24, keys 40, depth 2. Query, do not dump.

## Labels and minified builds

Minifiers keep property names and mangle class names - keys survive production, `constructor.name` does not. Each class gets an opaque `typeId` at first sight and a `site` (construction stack) for a resolver. Label resolution order:

1. `label(Type, name)` or `static displayName`
2. a table from `resolve({ [typeId | site]: name })`
3. the class name, if longer than two characters
4. `typeId`

For builds an agent or devtool will touch, keep class names: esbuild `keepNames`, terser `keep_classnames`. Property mangling is unsupported.

## Journal

Off by default; nothing is retained until asked.

```ts
journal.record({ level: 'keys' })                  // keys only
journal.record({ level: 'values', calls: true })   // values and method calls
journal.record({ level: 'keys', types: ['Composer'] })
journal.record({ paths: ['Composer.draft', 'T3.openTabs', `${id}.value`], keys: ['status'] })
journal.frames({ since, type, id, key, cause })
journal.history({ id, key })       // flat [{ seq, at, event }]
journal.downstream(seq)            // frames reachable through cause
journal.seq()                      // pass back as since
journal.export({ since })          // NDJSON, one event per line
journal.clear()
```

Filters OR together; none set records everything. `paths` take a label, `typeId`, or instance id left of the dot and a property right - events key on the instance that changed, so `Chats.openTabs`, never the owner path `Pairing.chats.openTabs`. `keys` match that property on any type.

A frame is one synchronous batch of writes plus its flush, including writes effects make synchronously during it - the unit React commits. Work an effect defers to a later microtask opens a new frame with `cause` set to the scheduling frame; work deferred to a macrotask starts a new root. Events: `update` (stored key), `event` (custom dispatch), `call` (method, `render` excluded), `destroy`. Retains 500 frames.

Bulk analysis belongs outside the page: `export` to a sidecar and query there.

## Testing a State

`act` is the default assertion for State specs - run a mutation, get back what changed:

```ts
import { attach, find } from '@expressive/inspect';

attach();
const composer = Composer.new();
const frames = await find('Composer')!.act((s) => s.submit('hi'));
expect(frames[0].events.map((e) => e.key)).toEqual(['draft']);
```

Host-agnostic packages depending only on `@expressive/mvc` get the same seat.

## Bridge

`@expressive/inspect/bridge` drives the page's global from outside, through anything with `evaluate(fn, arg)` - Playwright `Page`, `Frame`, `Locator`, puppeteer `Page`/`Frame`, or a CDP session wrapped to that shape. No driver dependency. Each method is one round trip.

```ts
import { inspect } from '@expressive/inspect/bridge';

const api = inspect(page);                                  // or a frame - see below
expect(await api.get('Composer.draft')).toBe('');
const since = await api.journal.seq();
await page.click('#submit');
const frames = await api.journal.frames({ since, type: 'Composer' });

const produced = await api.around(() => page.click('#submit'));   // act across the wire
await api.journal.record({ level: 'keys', types: ['Composer'] }); // labels, not classes
```

For an app in an iframe, pass that frame: `inspect(page.frame({ name }))`, or a locator such as `inspect(page.frameLocator('iframe[title="App"]').locator('body'))` - the helper accepts `Locator.evaluate`'s element-first arity. A missing global throws one line naming the install import - that is the install-order check.

Drive input through the UI; assert on the model. Reserve DOM assertions for presentation the model does not express.

## Vite

`@expressive/inspect/vite` reaches the page a developer has open - any browser, no debug port - through the dev server.

```ts
// vite.config.ts
import inspect from '@expressive/inspect/vite';

export default defineConfig({ plugins: [inspect()] });
```

Dev server only. Injects `install` ahead of the app entry (a manual import becomes redundant, harmless) and relays over Vite's HMR socket. Pre-bundles `install` when inspect comes from `node_modules`, so a cold dep cache cannot split mvc into two copies.

```bash
curl localhost:5173/__inspect                                     # [{ id, url, title, top }] per document, iframes included
curl localhost:5173/__inspect/4rrsel -d '["get", "Counter.current"]'
curl localhost:5173/__inspect -d '["journal.frames", { "since": 3 }]'   # the only connected page
```

- Body `[method, ...args]`, method dotted from the console API (`get`, `set`, `call`, `models`, `tree`, `journal.record`, ...). Response is the JSON result.
- No id with several pages connected: 409 plus the page list - never guesses.
- Ids are per page load; a reload issues new ones, closed pages drop out.
- 404 unknown page, 500 the page threw (`{ error }`), 504 no answer within 10s.
- Local callers only: 403 for a request carrying `Origin`/`Sec-Fetch-Site` (a web page) or a proxy header (`Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`). Behind a tunnel, pages still connect; only `curl` on the dev machine reaches the relay. A proxy that strips these headers bypasses the guard - securing an exposed dev server is on its owner.
- No HTML (`appType: 'custom'`): `import 'virtual:expressive-inspect'` first in the entry.

Functions do not cross HTTP - `act` and `around` stay in process or on the bridge.

What to reach for, in order:

1. **Observe** - `models`, `tree`, `get`, `journal.*`. Most questions end here.
2. **Act through the model** - `call("Type.method", ...)` runs the app's own logic; the way to reproduce what a user did.
3. **Force a state** - `set("Type.key", value)` bypasses the model; for setting up a repro, sparingly.

The relay reaches only the inspector's own members - no `eval`, no property walks beyond them. Arbitrary JS belongs to a driver's `evaluate`, granted by whoever runs the harness.

## Several instances of one type

`find('Row')` and `get('Row.x')` take the first live instance. Disambiguate by id (`models().filter((m) => m.type === 'Row')`, then `get(`${id}.x`)`), or address through the owner (`Table.rows`, not a bare `Row`).
