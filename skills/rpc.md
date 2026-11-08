# @expressive/rpc

Typed server calls for any Vite client build. Modules in one folder (`api/` by default) run on the server; the client imports them as usual and gets stubs that POST per call. Types come from the source - no schema, no codegen step.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import rpc from "@expressive/rpc/vite";

export default defineConfig({ plugins: [rpc()] });   // rpc({ dir: "api", opaque: true })
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
- `Error` subclasses - rebuilt on the client when thrown, so `instanceof` holds; message and own fields cross.
- In an `index.ts` only, a default `Model` subclass - the folder's gate.

Anything else fails the build: a sync function, a value, a re-export, a non-Error class, a default outside an index. Twin-shaped exports (Model classes) are refused - stateful twins are `@expressive/dev`'s.

Only calls the client build imports are served. Helpers belong outside `dir` (`server/`, `shared/`) and are imported from it; a type a call's signature names must be importable by the client.

## Addressing

Folders are layers, static names only (`[param]` folders throw). A module posts to its folder's path - `api/todos.ts` → `POST /`, `api/admin/users.ts` → `POST /admin` - with `x-expressive-call: <module>:<export>` (an index's export alone). Ids are readable in dev and salted hashes in build, so a client from an older deploy fails instead of calling changed code. `opaque: false` keeps readable ids for clients that outlive a deploy (installed PWAs, native shells).

## Errors

`HttpError` and its subclasses map to statuses: `BadRequest` 400, `Unauthorized` 401, `PaymentRequired` 402, `Forbidden` 403, `NotFound` 404, `MethodNotAllowed` 405, `Conflict` 409, `Gone` 410, `PayloadTooLarge` 413, `UnprocessableEntity` 422, `TooManyRequests` 429, `InternalError` 500, `NotImplemented` 501, `ServiceUnavailable` 503, `Redirect(location, status = 302)`. Extend one, or set `status` on your own, to add a kind. Any other thrown error replies 500 - its message in dev, a generic one in build.

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

Inside a call, `Session.get()` finds that instance; `Current.get()` is the request - `.request` (a Web `Request`), `.url`, `.cookies` - read-only, server-only. A gate instance is cached per key for `static ttl` seconds - an optimization: derive its state from the request, never from an earlier call. Calls cannot set response headers or cookies yet.

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

## Build and deploy

`vite build` emits `dist/client` and `dist/server/index.js`, a self-contained `export default { fetch(request, env) }` holding only the calls the client imported. Non-call requests go to `env.ASSETS` when bound, else 404.

- **Cloudflare Workers:** `main: "dist/server/index.js"`, `compatibility_flags: ["nodejs_compat"]` (required), `no_bundle: true`, `assets: { directory: "dist/client", binding: "ASSETS", run_worker_first: true }`.
- **Node:** `toNode(server.fetch)` from `@expressive/rpc/http` is a `(req, res)` handler; serve static files yourself.

Use `vite build` or `createBuilder().buildApp()` - the legacy `build()` API builds the client only.

## Limits

- Arguments and results are JSON - no `Date`, `Map`, binary.
- Worker bindings (`env`) and `ctx` do not reach calls - import `env` from `cloudflare:workers`.
- The generated server is the whole Worker entry: it cannot sit beside other routes, a Durable Object export or a `scheduled` handler.
- Module state lives per isolate or process - keep shared state in a store.
- An error class extending a package's export (`extends ZodError`) is not followed; the server checks it is an `Error` at startup.
