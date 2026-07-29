---
"@expressive/mvc": minor
"@expressive/react": minor
"@expressive/router": patch
---

Make root (global) registration opt-in via `static global`.

Previously any `State.new()` activated outside a Provider registered itself into the process-global root context, becoming resolvable via `get()` from anywhere. This made an accidental global easy to create — a forgotten `<Provider>` would silently land a per-request instance in the shared root, where it persists for the life of the process and (during server render) is shared across every request.

**Breaking:** a State now registers to the root context only when it declares `static global = true`. Without it, a context-less instance is still fully functional but private — not resolvable via `get()` from elsewhere, and never shared across server-render requests. A private instance can still *read* declared globals through the root fallback; it simply isn't one. Scope request state with `<Provider>`, or declare `static global = true` for a genuine process-wide singleton (e.g. a router, keyboard, or `localStorage` adapter).

During a server render (`Context.sealing`), a context-less non-global logs a one-time dev-only warning naming the fix, since it most often means a missing Provider. Declared globals continue to register and are sealed read-only on the server, exactly as before.

`@expressive/router`'s `Router` now declares `static global = true`, preserving the default single-router behavior under the new rule; an app that navigates during server render should provide its own `Router` per-request.
