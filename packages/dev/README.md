# @expressive/dev

`expressive dev` and `expressive build` for an Expressive app: Vite underneath, `@expressive/dom`
as the renderer, `@expressive/router` for the tree that `app/` generates, and `@expressive/inspect`
on the dev server.

## Project layout

```
app/                  file-based routes
  index.tsx           /            exports: Page, Layout, Loading, Catch, NotFound, default
  (about).tsx         /about       static leaf
  blog/index.tsx      /blog        folder = scope; its index is the "/blog" page
  blog/[slug].tsx     /blog/:slug  param leaf
  docs/[...].tsx      /docs/*      catch-all
  blog/remote.ts      sidecar      server module for /blog and below
  blog/remote/        sidecar      or a folder of them, any depth, index optional
app.tsx | src/app.tsx single root component instead of app/ (default export)
index.ts              optional service entry, run on the server: export default config({ port })
index.html            optional custom shell (#root and the entry script are injected if missing)
vite.config.ts        optional, merged under the host's config
```

Bare-named files under `app/` are support modules, not routes. `Page` may be a function, reading
its params through `Route.get().match`, or `class Page extends Route` (from `@expressive/dev`) with
`this.match`, its own fields and `render()`. That is the one intended use of `Route` - folders
express nesting. dev's `Route` owns no suspense boundary unless given a `fallback` or `Catch`, so a
page's waits show its slot's `Loading`.

The `default` export is read by kind. A function is the entry hook: it runs with the Route before
it renders, and a returned string redirects (`null` falls through to the 404). In a folder with a
seat, it runs once the seat's twin is fetched (Entry, below). A class - Model or
Component - renders around the route's content and is provided to everything below it; with a
`Layout`, it wraps the `Layout`.

`Loading` is the placeholder for the content slot of the `Layout` beside it: any page rendered
there that cannot show anything yet - its code, its entry hook or its data still pending - shows
it in place, inside the layout. It reaches pages at any depth until a nested `Layout`, which starts
its own slot. A page's own `Loading` covers that page first. Navigation inside the app never shows
it - the current page holds until the next is ready (`Router.get().navigating` meanwhile); it is
for arriving cold, by link or refresh. A Component or a Model with its own `fallback` keeps its
waits to itself.

Each route module becomes its own chunk, loaded when the route is first entered - `default`
included - unless it is the root or exports `Loading` or `Catch`, which must be on hand before
anything below them can wait or fail.

JSX compiles against `@expressive/dev`'s runtime, which is `@expressive/dom`'s. Set
`"jsxImportSource": "@expressive/dev"` in the app's tsconfig; the types carry dom's `Model`
augmentation (`Model.get()` and friends), so nothing else is needed.

## Server

`index.ts` runs on the server - in dev on Vite's module runner, in production inside
`dist/server/index.js`, which serves `dist/client` and falls back to `index.html` for client routes.
It imports `config` from `@expressive/dev/server`: `port`, and `remote.opaque` (below).

### Sidecars

A `remote.ts` in a route folder runs on the server. Each export is an `async` function; the browser
imports a stub that calls it. For more than one module, use a `remote/` folder instead: every module
in it, at any depth, belongs to the parent folder - `app/blog/remote/feed/latest.ts` runs for `/blog`,
and `remote/` is never a route.

```ts
// app/tally/remote.ts
let total = 0;
export async function add(by: number) { return (total += by); }
```

```tsx
// app/tally/index.tsx
import { add } from "./remote";
```

A call is `POST` to the folder's path with its params filled from the current location (`/blog/a`
for `app/blog/[slug]/remote.ts`), an `x-expressive-call` header naming the function (`add`, or
`feed/latest:add` inside `remote/`), the tab's `x-expressive-connection` id, and the arguments as a
JSON array. The reply is `{ value, frame }` - the frame carries what the call changed on the tab's
twins (below). Only the folder and those below it may import its sidecar.

Only what the client imports is callable: the server accepts calls to the stubs the browser loaded in
dev, and to those the client build generated in production - a helper module in `remote/` is never
an endpoint. Remote calls are not a public API. The production build names each call by a hash
unique to the build, so a stale tab fails rather than calling changed code; `remote: { opaque: false }`
in `index.ts` keeps readable names, for clients that must outlive a deploy.

A sidecar may also export `Error` subclasses. Thrown on the server, one rejects the call on the
client as the same class - `instanceof` works - with its message and own fields; a numeric
`status` field in 400-599 sets the reply's status (409 below, else 500); a 3xx `status` with a
`location` field redirects a refused entry (below) and replies 500. Any other thrown error
rejects with its message in dev and a generic one in production.

```ts
export class Overflow extends Error {
  status = 409;
  constructor(public limit: number) { super(`The tally stops at ${limit}.`); }
}
```

The build refuses any other export - a sync function, a value, a class without `extends` or a
re-export - since the client could not use it; a default is the folder's twin (below). A class whose base is not an `Error`
fails its first call in dev and the built service at startup.

### Server Model

Server Model is a folder's `default` class - its seat, built at the call's location - and the
children it owns. Inside a call, `X.get()` finds the nearest seat or owned child at that location
or above; it throws outside a call. `/blog/a` and `/blog/b` hold separate seats, every visitor to a
location shares one, and a seat further down shadows one above. A seat lives while a call holds it,
then `static ttl` seconds (300 by default); `set(null)` ends it at once, with its children. A child
created lazily (`draft = set(() => new Draft())`) is found once its owner has read it - reach it
through the owner (`Tally.get().draft`).

```ts
export default class Tally extends Model {
  static ttl = 3600;
  total = 0;
}

export async function add(by: number) {
  return (Tally.get().total += by);
}
```

`Current` (from `@expressive/dev/server`) is the request in progress, readable from any server
Model or function in a call: `Current.get().url`, `.cookies`, `.request` (a Web `Request`), and `setHeader` for
that call's reply. Cookies the app uses are better declared as a `Cookies` subclass (see below). Its accessors read the
call live, so a reused instance may hold it in a field (`current = get(Current)`) but should not
copy its values into its own.

### Twins

A folder's remote entry (`remote.ts` or `remote/index.ts`) may default-export a Model class. Every
call walking through the folder seats one instance in its context - `get()` finds it there and below
- and on the client the folder's Route builds its twin and provides it below. The twin's methods
are the class's public `async` methods, each a call to that instance.

```ts
// app/counter/remote.ts
export default class Counter extends Model {
  count = 0;
  async increment() { return ++this.count; }
}
```

```tsx
// app/counter/index.tsx
import Remote from "./remote";

export class Page extends Component {
  remote = get(Remote);
  render() {
    const { remote } = this;
    return <button onClick={() => remote.increment()}>{remote.count}</button>;
  }
}
```

`static key()` narrows the folder's context, and everything below it, by what it returns - an
identity from a `Cookies` field, or a value from a seat above through `get()`. Undefined passes
the location through; throwing denies the call. Build the key from verified data only - a raw cookie
lets the client pick its context - and declare it `protected`. The seat lives for `static ttl` after
its last call; when it ends, its context and everything below go with it.

#### Entry

Entering a folder with a seat waits for the server. Its Route builds the twin and holds the page -
the current one during in-app navigation, `Loading` on a cold load - until the twin's first pull
returns. The pull walks every `key()` from the root down to the folder, and waits for each seat it
newly builds - an `async new()` included. The folder's entry hook then runs with `route.remote`
fetched. A refused pull reaches the nearest `Catch`; an exported error class carrying a 3xx `status`
and a `location` field redirects there instead, as does one thrown by the hook. Leaving the route
ends the twin; returning, or a change of the folder's own params, builds a fresh one.

```ts
// app/account/remote.ts
import { Cookies } from "@expressive/dev/server";

class AppCookies extends Cookies {
  session?: string = undefined;
}

export class SignIn extends Error {
  status = 302;
  location = "/login";
}

export default class Account extends Model {
  name = "";
  admin = false;

  protected static key() {
    const { session } = AppCookies.get();
    if (!session) throw new SignIn("Sign in first.");
    return session;
  }

  protected async new() {
    const user = await db.user(AppCookies.get().session!);

    this.name = user.name;
    this.admin = user.admin;
  }
}
```

```tsx
// app/account/index.tsx
import type Account from "./remote";

export default (route: Route & { remote: Account }) => (route.remote.admin ? undefined : "/");

export class Page extends Route {
  declare remote: Account;

  render() {
    return <h1>{this.remote.name}</h1>;
  }
}
```

A `Route` below the folder reads the seat as `this.remote`; `declare remote: Account` types it.
Declare it rather than `remote = get(Account)`, which replaces the field and, on the folder's own
Route, looks past the twin that Route provides. Anything else below reaches it through `get(Account)`.

Methods a seat inherits cross too: the build follows its bases by import - source, or a package's
`.d.ts` - up to `@expressive`'s classes, and the nearest declaration's `private`/`protected` wins. A
base it cannot follow, such as `extends mixin(Model)`, fails the build.

A twin holds the seat's public values too. It attaches a microtask after construction and suspends until the
snapshot arrives. Every call's reply - a twin's method or a plain function - carries everything that
changed on any twin the tab holds since that twin last heard, so an awaited call never reads stale,
even where it changed a parent folder's twin through `get()`. Values change on the server only -
assigning a twin field throws. Changes made elsewhere - another tab, a timer on the server - arrive
on a stream the tab opens with its first twin: the server names what went stale and the twin pulls
it.

A field holding a Model its class owns - `line = new Line()`, or one declared `line?: Line` - is a
child: the twin holds a twin of it, read-only like its other values, whose public `async` methods
call through the owner (`order.line.bump()`). Assigning a new instance on the server replaces the
child twin; clearing the field leaves it `undefined`. A public `get()` field fails the build - make
it `protected` or `private`.

A value still pending on the server - a `set()` field not yet assigned, or a getter waiting on one -
is pending on the twin too: reading it suspends until the server assigns it. A value the twin already
holds stays, unless the server rebuilt the instance.

A remote module may also export Model classes. Each is a twin built per construction: every one a
Component owns as a field (`cart = new Cart()`), or `Cart.new()` anywhere, gets a server instance of
its own, alive while the client holds the twin. Build twins through those two - not a standalone
`new Cart()`. It is built under the component's nearest route, so its `get()` fields reach the seats
above it and every `key()` above it runs on each call; off any route it has no seat above it.

```ts
// app/shop/remote.ts
import { Model, get } from "@expressive/mvc";

export default class Shop extends Model {
  name = "Shop";
}

export class Cart extends Model {
  protected shop = get(Shop);
  items = 0;
  async add() { return ++this.items; }
}
```

Reload the page when a call changes what a seat's `key()` returns - a login, a logout, switching
accounts. Twins hold the context they were built in; a pooled twin's next request is refused once that
context is replaced, but values already shown, client state under the route and replies to other
calls can still carry the previous identity's data until the page reloads.

## Commands

```
expressive dev             Vite dev server with HMR; /__inspect relay
expressive build           dist/client (static app) and dist/server/index.js (node service)
expressive build --pretty  unminified client, stable filenames
expressive build --prerender  also writes dist/client/<path>/index.html per static page
node dist/server/index.js  run the built service (port from index.ts, default 3000)
```

### Prerendering

`expressive build --prerender` bundles the app for Node after the build, renders each page with
`renderToString` from `@expressive/dom/server`, and writes it, with the style rules it used, to
`dist/client/<path>/index.html`. Suspended data is awaited; effects never run, so data loaded in an
effect is not in the page.

Only pages that need nothing at request time are rendered. A `[param]` or `[...]` route is skipped
unless its module exports `paths()`, returning the absolute paths to render:

```tsx
// app/blog/[slug].tsx
export const paths = async () => (await listPosts()).map(post => `/blog/${post.slug}`);
```

Every folder with a `remote.ts` or `remote/` folder is skipped, along with everything below it.
Those pages stay client-rendered, and the build never runs server code. A page that redirects,
renders nothing or throws is skipped with a warning. The bundle uses the client's transforms, so a
remote module is only ever its call stub.

The empty shell moves to `dist/client/200.html`. The built service serves `<path>/index.html`, then
falls back to the shell; a static host needs its fallback pointed at `200.html` (Cloudflare Pages:
`/* /200.html 200` in `_redirects`). On load, the client renders into a hidden copy of the root and
swaps it in once it matches the static page, or after a second - there is no hydration, so the page
is not interactive until then.

Nothing is written into the project. The shell, the client entry and the generated router module
are virtual, addressed under `/.expressive/`. The router module regenerates when files appear or
vanish under `app/`.

`@expressive/dev/vite` exports the `expressive()` plugin for a hand-written Vite config; the CLI
adds it and `@expressive/inspect/vite`. Server-only API - `config`, `serve`, `Current` - is
`@expressive/dev/server`; the generated server entry imports `serve` from there.

## Example

`example/` is a routed app, typechecked with the package. Running it needs a build: after
`bun run build` at the repo root, `bun run example`, `bun run example:build` or
`bun run example:start` here.

`bun run example:e2e` here runs its Playwright specs (`example/e2e/`) against both the dev server
and the built service, after `bun run build` at the root. Set `CHROME` to use a local Chromium
binary.
