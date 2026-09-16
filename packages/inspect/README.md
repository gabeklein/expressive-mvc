<h1 align="center">@expressive/inspect</h1>

<p align="center">
  In-process inspector for Expressive MVC state.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/inspect"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Finspect.svg"></a>
</p>

---

Query the live model graph of an [Expressive MVC](https://github.com/gabeklein/expressive-mvc) app from a test, a Playwright spec, or the browser console. No UI, no network - a base layer for agents, devtools, and test helpers.

```bash
npm install --save-dev @expressive/inspect
```

## Install into the app

```ts
// first import of the app entry, before any State is constructed
import '@expressive/inspect/install';
```

Attaches to every `State` and publishes `globalThis.__EXPRESSIVE_INSPECT__`. For a shipped build, call `attach()` behind your own dev flag instead of the side-effect import.

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
import { inspect } from '@expressive/inspect/playwright';

const api = inspect(page);                   // Page, Frame, or Locator
await api.get('Composer.draft');
const frames = await api.around(() => page.click('#submit'));
```

Console: `__EXPRESSIVE_INSPECT__.get('Composer.draft')`, `__EXPRESSIVE_INSPECT__.journal.record({ level: 'keys', paths: ['Composer.draft'] })`.

## Journal

Off by default. `journal.record({ level, types, paths, keys, calls })`, then `frames({ since })`. A frame is one batch of writes plus its flush; work an effect defers carries a `cause` back to the frame that scheduled it. `export()` emits NDJSON for a sidecar.

## Orphans

Instances a host never committed - a render thrown away, a StrictMode twin - stay out of `models()` and `tree()`. `orphans()` lists them, `warnings()` counts them.

## Minified builds

Property names survive minification; class names do not. Each class gets a stable `typeId` and a construction `site`. Name them with `label(Type, 'Composer')`, `static displayName`, or `resolve({ T3: 'Composer' })`, or keep names at build time (`keepNames`, `keep_classnames`).

Full reference: [skills/inspect.md](https://github.com/gabeklein/expressive-mvc/blob/main/skills/inspect.md).
