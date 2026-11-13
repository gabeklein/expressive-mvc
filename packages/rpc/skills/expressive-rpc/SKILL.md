---
name: expressive-rpc
description: Typed server calls for Vite apps (@expressive/rpc) - modules in api/ run on the server, the client imports them as stubs, and the folder is the server's router. Use when adding or debugging server calls or routes - module rules, GET/POST route modules, [param] folders, values, http errors, gates and Current, client configure, base, server entry, Worker/Node deploy.
---

# @expressive/rpc

Typed server calls for any Vite client build. Modules in one folder (`api/` by default) run on the server; the client imports them as usual and gets stubs that POST per call. Types come from the source - no schema, no codegen step.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import rpc from "@expressive/rpc/vite";

export default defineConfig({ plugins: [rpc()] });   // rpc({ dir: "api", opaque: true, base: "" })
```

```ts
// api/todos.ts
import { HttpError, NotFound } from "@expressive/rpc";

export class ProOnly extends HttpError { status = 402; }

export async function done(id: string): Promise<Todo> {
  const todo = todos.find(todo => todo.id === id);
  if (!todo) throw new NotFound(`No todo ${id}.`);

  todo.done = true;
  return todo;
}
```

```ts
// src/main.ts
import { done, ProOnly } from "../api/todos";

try { await done(id) } catch (error) { if (error instanceof ProOnly) upsell() }
```

## Module rules

A module under `dir` may export:

- `async` functions - the calls.
- Functions named for a request method - `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` - which make it a [route](#routes), answered on the server only. Only a module named `[name]`, `[...]` or `(name)` may export them.
- `Error` subclasses - rebuilt on the client when thrown, so `instanceof` holds; message and own fields cross.
- In an `index.ts` only, a default `Model` subclass - the folder's gate.

Anything else fails the build: a sync function, a value, a re-export, a non-Error class, a default outside an index. Twin-shaped exports (Model classes) are refused - stateful twins are `@expressive/dev`'s.

Only calls the client build imports are served. Helpers belong outside `dir` (`server/`, `shared/`) and are imported from it; a type a call's signature names must be importable by the client.

`dir` is relative to Vite's root and may sit outside it: `rpc({ dir: "../api/src" })` serves calls from a sibling workspace package, imported from the client by relative path. Path aliases in that package's own tsconfig resolve with Vite's `resolve: { tsconfigPaths: true }`.

## Addressing

The folder is the server's router: each folder is a path segment, its `index.ts` gate covers everything under it, and each module is a leaf. A call's module posts to its folder's path - `api/todos.ts` → `POST /`, `api/admin/users.ts` → `POST /admin` - with `x-expressive-call: <module>:<export>` (an index's export alone). Ids are readable in dev and salted hashes in build, so a client from an older deploy fails instead of calling changed code. `opaque: false` keeps readable ids for clients that outlive a deploy (installed PWAs, native shells).

Names are path segments as `@expressive/dev`'s pages read them: `[id]` takes one segment as the param `id`, `[...]` takes the rest of the path (as the param `"*"`, none included, and only as a file), and `(name)` is `name` taken literally. A path matches a static name before a `[param]`, and a `[param]` before a `[...]`, backing off a branch that ends short. Calls live in static folders - the client has no value to fill a `[param]` with, so a call under one fails the build; pass it as an argument, or answer that path with a route.

`rpc({ base: "/api" })` serves the folder under `/api` - `api/todos.ts` posts to `/api`, a route at `api/files/[id].ts` answers `/api/files/7` - and the client's stubs send there. Anything outside the base is the entry's or the assets'.

## Routes

A module exporting functions named for request methods is a route at its path. Its name says so: only `[name]`, `[...]` and `(name)` modules are addresses, so a plain-named module - a helper, or one of calls - never answers a URL of its own, and exporting `GET` from one fails the build.

- `api/jobs/[id]/(events).ts` answers `/jobs/7/events`; `api/files/[id].ts` answers `/files/7`.
- `api/files/(index).ts` answers `/files` itself - `index.ts` is the folder's gate, never a route.
- `api/files/[...].ts` answers everything under `/files` nothing nearer claims, `/files` too unless `(index).ts` does. The rest is the param `"*"`, `""` at the folder.
- Each URL has one owner: `(files).ts` beside a `files/` folder fails the build - move it in, as `files/(index).ts`. So a route runs behind exactly the gates of the folders on its path.

```ts
// api/account/jobs/[id]/(events).ts
import Account from "../../index";

export async function GET(request: Request, { id }: { id: string }) {
  const job = jobs.find(id);
  if (job?.owner !== Account.get().id) return new Response("Unknown job.", { status: 404 });
  return new Response(job.events(), { headers: { "content-type": "text/event-stream" } });
}
```

- Each takes the request and the route's params, and returns a `Response` - streamed, binary or multipart, as the body allows.
- It runs behind the gates of the folders along its path, as a call there would: each is seated and its `new()` awaited, so `Account.get()` works inside. `(events).ts` runs behind its folder's gates; `files/(index).ts` behind `files/`'s as well. A gate keyed by a param reads it from `Current.get().params`.
- A refusal, or any error, answers as a call's would: its status and `{ error, message }` as JSON. A gate that should answer differently - 404 rather than 401, say - throws that from its own `key()` or `new()`.
- A method the module does not export answers 405 with `Allow`; `HEAD` falls back to `GET`.
- What `Cookies` and `Current.setHeader` set joins the response.
- The client's stub never has them: a route module is the server's, served whether or not the client imports it. A module may hold calls and methods both, in a static folder.
- The `[param]`s of one folder need one name, or the build fails.
- A method is usually a function written in place. One made by a call - `fromNode(app)`, Hono's `app.fetch` - is checked when it runs; a literal, object or class fails the build.

### Node handlers

`fromNode(handler)` from `@expressive/rpc/node` makes an Express app, Connect middleware or bare `(req, res, next)` a route's method - for code already written against Node:

```ts
// api/admin/email/[...].ts
import express from "express";
import { fromNode } from "@expressive/rpc/node";
import { emailRoutes } from "../../email/routes"; // an express.Router()

export const GET = fromNode(express().use(emailRoutes));
```

- It sees the path below the route - under `[...].ts` the rest, `/attorney/7/scheduled` - with `req.originalUrl` the whole path. Mount a `Router()` in an app as above: Express adds `res.send`, `res.json`... only inside one.
- It runs in the request's scope, behind the folder's gates: `Staff.get()`, `Current` and `Cookies` work in its handlers, and what they set joins the response.
- What it writes streams out as written. `next()` answers 404; `next(error)` and a throw fail as a route's would.
- Node only - `node:http` is not in a Worker. A method taking three parameters that returns nothing fails with a hint to wrap it.

## Values

Arguments and results cross as JSON plus what JSON loses: `Date` (an invalid one too), `BigInt`, `NaN` and `±Infinity`, `Map`, `Set`, `Uint8Array` and `ArrayBuffer` (arriving as `Uint8Array`), and `undefined` in an array - so `f(a, undefined)` keeps its default. Each goes as a one-key tagged object (`{ "$date": "2026-11-08T12:00:00.000Z" }`), so the body stays readable JSON; a plain object whose only key is a tag is escaped, so data never reads as one. The rest is `JSON.stringify`'s: `toJSON` first, `undefined` and function properties dropped, class instances as their own enumerable fields, a circular structure refused. A thrown error's own fields ride the same codec.

## Errors

`HttpError` and its subclasses map to statuses: `BadRequest` 400, `Unauthorized` 401, `PaymentRequired` 402, `Forbidden` 403, `NotFound` 404, `MethodNotAllowed` 405, `Conflict` 409, `Gone` 410, `PayloadTooLarge` 413, `UnprocessableEntity` 422, `TooManyRequests` 429, `InternalError` 500, `NotImplemented` 501, `ServiceUnavailable` 503. A status outside 400-599 replies 500 with the error's fields intact - `Redirect(location, status = 302)` arrives as a `Redirect` carrying both, for the client to act on. Extend one, or set `status` on your own, to add a kind. Any other thrown error replies 500 - its message in dev, a generic one in build.

## Gates and Current

An index's default Model gates every call in its folder and below. Its `static key()` runs per call, root first: throw to refuse, return an identity to give the folder's context one instance per value, `undefined` to pass through.

```ts
// api/index.ts
import { Model } from "@expressive/mvc";
import { Current, Unauthorized } from "@expressive/rpc";

export default class Session extends Model {
  static key() {
    const token = Current.get().request.headers.get("authorization");
    if (!token) throw new Unauthorized("Sign in first.");
    return token;
  }
}
```

Inside a call, `Session.get()` finds that instance; `Current.get()` is the request - `.request` (a Web `Request`), `.url`, `.cookies` - read-only, server-only. A gate runs per request: its instance ends with the last call holding it. `static ttl = 60` keeps it per key that many seconds after - an optimization, so derive its state from the request, never from an earlier call - and `Session.get().set(null)` ends a cached one at once (say, in `logout()`).

### Cookies

Declare the cookies the app uses as fields of a `Cookies` subclass - one field per cookie, its initial value the default when the request has none - and read and write them as a Model:

```ts
// lib/cookies.ts - a non-Error class cannot be exported from api/
import { Cookies } from "@expressive/rpc";

export class AppCookies extends Cookies {
  static options = { session: { maxAge: 60 * 60 * 24 * 30 } };

  session?: string = undefined;
  theme = "light";
}
```

```ts
// api/auth.ts
import { Unauthorized } from "@expressive/rpc";
import { AppCookies } from "../lib/cookies";

export async function login(user: string, password: string) {
  const session = await sessions.open(user, password);

  if (!session) throw new Unauthorized("Wrong password.");

  AppCookies.set({ session: session.id });
}

export async function logout() {
  AppCookies.set({ session: undefined });
}
```

- `AppCookies.get()` is this request's instance - one per request and class, built from its `cookie` header. A field the request lacks keeps its default. Reads see this call's writes.
- `AppCookies.set({ ... })` is sugar for `AppCookies.get().set({ ... })`. When the call replies, each field that changed goes out as `Set-Cookie`, and one set to `undefined` is removed with the path and domain it was set with. It goes out on a failure too, and a gate's `key()` can use it.
- `static options` holds per-cookie options by field: `maxAge` (seconds), `expires`, `path`, `domain`, `secure`, `httpOnly`, `sameSite`, `partitioned`. Unset ones are `HttpOnly`, `SameSite=Lax` and `Path=/`, plus `Secure` over https. Values are strings, URI-encoded on the wire.
- Reach it through `AppCookies.get()` within a call, never `get(AppCookies)` as a field - a Model reused across calls would hold one request's cookies, so it is not in context and that lookup fails.

Set-Cookie reaches a browser's cookie jar on its own; a cross-origin client needs `credentials: "include"` in its `transport`.

`Current` is the lower level, for adapters and libraries: `.request`, `.url`, `.cookies` (every cookie as sent, undeclared ones included) and `setHeader(name, value)` for any other reply header - the reply's own (`content-type` and the like) win; read one on the client through `configure({ reply })`.

## Client

Stubs call through a shared client, `fetch` by default:

```ts
import { configure } from "@expressive/rpc";

configure({
  base: "https://api.example.com",          // cross-origin or no `location` (Node, native)
  headers: () => ({ authorization: `Bearer ${token}` }),
  transport: request => fetch(request),     // replaces fetch - service bindings, retries
  reply: async response => {},              // sees every response
});
```

`client(options)` builds a separate one. Without a `location`, a relative `base` throws - pass an absolute one.

`withOptions` applies a `signal` or a `timeout` (ms) to the calls a function starts - synchronously, so not one made after an `await` inside it:

```ts
import { withOptions } from "@expressive/rpc";

const todos = await withOptions({ signal: controller.signal, timeout: 10_000 }, () => list());
```

An abort rejects with the signal's reason; a timeout with a `TimeoutError`. Nested, the inner options extend the outer.

## Server entry

For what lives outside the folder - a path beside the base, a `scheduled` handler, Durable Object classes, a fallback to `ASSETS` - write the server yourself and name it:

```ts
// vite.config.ts
export default defineConfig({ plugins: [rpc({ entry: "server.ts" })] });
```

```ts
// server.ts
import { handle } from "@expressive/rpc/calls";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/health") return Response.json({ ok: true });

    return (await handle(request)) ?? env.ASSETS.fetch(request);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {},
};

export { Room } from "./room";   // a Durable Object, say
```

- `handle(request)` answers a call or a [route](#routes) of the folder and gives anything else `undefined`. A route that needs a folder's gates belongs in the folder.
- The entry and the calls share one copy of every module, in dev and in the build.
- The entry's `fetch` runs in the request's scope, as a call does: `Current.get()` is the request and a `Cookies` subclass reads and sets cookies in any route, what it sets joining the route's response.
- `vite build` bundles the entry as `dist/server/index.js`, its other exports included.
- In dev the entry's `fetch` runs on every request before Vite, with `ctx.waitUntil` logging a rejection. `env` is `rpc({ env })`'s result (say, wrangler's `getPlatformProxy().env`) plus an `ASSETS` that hands the request back to Vite.
- `@expressive/rpc/calls` is the server's: a client import fails the build, and a call to `handle` outside a server the plugin builds or runs throws. One rpc dev server per process serves it.

## Build and deploy

`vite build` emits `dist/client` and `dist/server/index.js`, a self-contained bundle holding the calls the client imported and every route module - the app's entry, or by default `export default { fetch(request, env) }`, which hands non-call requests to `env.ASSETS` when bound, else 404. `cloudflare:` imports stay external.

- **Cloudflare Workers:** `main: "dist/server/index.js"`, `compatibility_flags: ["nodejs_compat"]` (required), `no_bundle: true`, `assets: { directory: "dist/client", binding: "ASSETS", run_worker_first: true }`.
- **Node:** `toNode(server.fetch)` from `@expressive/rpc/http` is a `(req, res, next?)` handler - `next` gets what the server answers `undefined`; serve static files yourself.
  - It mounts in Express (or Firebase Functions' `onRequest`) like any middleware: `app.use(toNode(server.fetch))`.
  - To keep `node_modules` installed rather than bundled - native or heavy packages like `pg` and `firebase-admin` - set the server environment's own externals; rpc then bundles only the calls and what you name:

    ```ts
    export default defineConfig({
      plugins: [rpc()],
      environments: { rpc: { resolve: { noExternal: [] } } },   // or ["@expressive/rpc"] to bundle rpc too
    });
    ```

Use `vite build` or `createBuilder().buildApp()` - the legacy `build()` API builds the client only.

## Limits

- Binary goes base64 inside the JSON body - fine for documents and images, not for large uploads. No `Blob`, `File` or streams as arguments; take them through a [route](#routes).
- Worker bindings (`env`) and `ctx` do not reach calls or routes - import `env` and `waitUntil` from `cloudflare:workers`, or handle the request in the entry.
- Module state lives per isolate or process - keep shared state in a store.
- An error class extending a package's export (`extends ZodError`) is not followed; the server checks it is an `Error` at startup.
