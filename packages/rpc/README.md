# @expressive/rpc

Typed server calls for any Vite client build. Put `async` functions in one folder; the client imports them like any module and gets stubs that call the server. Types come from the source - no schema, no codegen step.

```bash
npm install @expressive/rpc @expressive/mvc
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import rpc from "@expressive/rpc/vite";

export default defineConfig({ plugins: [rpc()] });
```

```ts
// api/todos.ts
import { NotFound } from "@expressive/rpc";

export async function done(id: string) {
  const todo = await db.todos.get(id);
  if (!todo) throw new NotFound(`No todo ${id}.`);

  return db.todos.update(id, { done: true });
}
```

```ts
// src/main.ts
import { NotFound } from "@expressive/rpc";
import { done } from "../api/todos";

try {
  await done(id);
} catch (error) {
  if (error instanceof NotFound) refresh();
}
```

`vite build` emits the client in `dist/client` and a server bundle in `dist/server/index.js` - `export default { fetch }` - that runs as a Cloudflare Worker (with `nodejs_compat`) or under Node through `toNode(server.fetch)` from `@expressive/rpc/http`.

- **Errors** - `HttpError` and its subclasses (`NotFound`, `Forbidden`, `Conflict`, ...) set the reply's status and are rebuilt on the client, so `instanceof` works. Export your own subclasses from the folder.
- **Gates** - an `index.ts` default `Model` with `static key()` runs before every call in its folder and below: throw to refuse.
- **Values** - `Date`, `BigInt`, `Map`, `Set`, `Uint8Array` and `undefined` in arrays survive the trip, tagged inside plain JSON.
- **Cookies** - declare them as fields of a `Cookies` subclass; `AppCookies.get().session` reads this request's, `AppCookies.set({ session: id })` sends `Set-Cookie` with the reply.
- **Request** - `Current.get().request`, `.url` and `.cookies` inside a call, and `setHeader` for its reply.
- **Client** - `configure({ base, headers, transport, reply })` for cross-origin servers, auth headers or a custom fetch.
- **Server entry** - `rpc({ entry: "server.ts" })` makes your own Worker-shaped module the server: it gets the calls as `handle(request)` from `@expressive/rpc/calls` and adds routes, a `scheduled` handler or Durable Objects beside them, sharing their modules in dev and build. Its routes run in the request's scope, so `Current` and `Cookies` work there as in a call.

Full reference: [skills/expressive-rpc](https://github.com/gabeklein/expressive/blob/main/packages/rpc/skills/expressive-rpc/SKILL.md), shipped in the package. A runnable app is in [`example/`](https://github.com/gabeklein/expressive/tree/main/packages/rpc/example).
