<h1 align="center">@expressive/inspect</h1>

<p align="center">
  In-process inspector for Expressive MVC state.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/inspect"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Finspect.svg"></a>
</p>

---

Query the live instance graph of an [Expressive MVC](https://github.com/gabeklein/expressive-mvc) app from a test, a browser driver (Playwright, puppeteer, CDP), or the browser console. No UI, and no network beyond an opt-in dev-server relay or server handler - a base layer for agents, devtools, and test helpers.

```bash
npm install --save-dev @expressive/inspect
```

## Install into the app

```ts
// first import of the app entry, before any Model is constructed
import '@expressive/inspect/install';
```

Attaches to every `Model` and publishes `globalThis.__EXPRESSIVE_INSPECT__`. For a shipped build, call `attach()` behind your own dev flag instead of the side-effect import.

## In process

```ts
import { find, roots } from '@expressive/inspect';

const composer = find('Composer');           // by label, or by id
composer.state                               // the raw instance
composer.parent / composer.children          // ownership
composer.get('draft')                        // stored value, no getter fires
const frames = await composer.act((s) => s.submit('hi'));   // run, settle, see what changed
```

## Across a boundary

```ts
import { inspect } from '@expressive/inspect/bridge';

const api = inspect(page);                   // anything with evaluate(fn, arg)
await api.get('Composer.draft');
const frames = await api.act(() => page.click('#submit'));
```

A Node process under `--inspect`, or a browser with a debug port: `inspect(await devtools())`, `devtools` from the same entry.

## From a running dev server

```ts
// vite.config.ts - installs the inspector and relays to open pages
import inspect from '@expressive/inspect/vite';

export default defineConfig({ plugins: [inspect()] });
```

```bash
curl localhost:5173/__inspect                                   # connected pages, iframes included
curl localhost:5173/__inspect/<id> -d '["get", "Composer.draft"]'
curl localhost:5173/__inspect/<id> -d '["act", ["call", "Composer.submit", "hi"]]'   # { value, frames, settled, pending }
```

Local callers only; browser and proxied (tunnel) requests are refused.

Console: `__EXPRESSIVE_INSPECT__.get('Composer.draft')`, `__EXPRESSIVE_INSPECT__.journal.record({ level: 'keys', paths: ['Composer.draft'] })`.

## From your own server

`handle` serves an installed inspector from a backend's own server - same body and answers as the relay; `GET` describes the process. It takes each host's native handler arguments, so it mounts as a route anywhere, nested routers included. Load both pieces only in dev, so the package can stay a devDependency.

Install before any Model is constructed:

```bash
bun --preload @expressive/inspect/install server.ts      # dev script
node --import @expressive/inspect/install server.js
```

```ts
// entry.ts - any runtime: install, then load the app
if (dev) await import('@expressive/inspect/install');
await import('./server');
```

`attach()` alone does not publish the global `handle` serves; without install it answers 404.

Mount the route:

```ts
const inspect = dev && (await import('@expressive/inspect')).handle;

// Bun
Bun.serve({ routes: inspect ? { '/__inspect': inspect } : undefined, fetch: app });

// Express, Connect, node:http
if (inspect) app.use('/__inspect', inspect);

// Deno, TCP listeners
if (inspect && pathname == '/__inspect') return inspect(req, info);

// Hono
if (inspect) app.all('/__inspect', (c) => inspect(c.req.raw, { ip: getConnInfo(c).remote.address }));

// any Request plus the socket address
if (inspect) return inspect(req, { ip });
```

Missing or non-loopback callers get 403, as do browser and proxied requests. A JSON array `express.json()` already read is used as is; mount before any other body parser. Next route handlers and Workers expose no socket address and are unsupported.

Static imports work only with the package as a runtime dependency. A bundled server resolves dynamic imports at build time, so the package must be installed when building.

## Journal

Off by default (the Vite relay records `keys` from load). `journal.record({ level, types, paths, keys, calls })`, then `frames({ since })`. A frame is one batch of writes plus its flush; work an effect defers carries a `cause` back to the frame that scheduled it. `export()` emits NDJSON for a sidecar; `summary()` digests it per instance.

## Orphans

Instances a host never committed - a render thrown away, a StrictMode twin - stay out of `models()` and `tree()`. `orphans()` lists them, `health()` counts them - along with loaded mvc copies and caught reports.

## Minified builds

Property names survive minification; class names do not. Each class gets a stable `typeId` and a construction `site`. Name them with `label(Type, 'Composer')`, `static displayName`, or `resolve({ T3: 'Composer' })`, or keep names at build time (`keepNames`, `keep_classnames`).

Full reference: [skills/inspect.md](https://github.com/gabeklein/expressive-mvc/blob/main/skills/inspect.md).
