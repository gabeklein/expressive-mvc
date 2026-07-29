---
"@expressive/mvc": minor
"@expressive/react": minor
"@expressive/router": patch
---

Make root (global) registration opt-in via `static global`.

Previously any `State.new()` activated outside a Provider registered itself into the process-global root context, becoming resolvable via `get()` from anywhere. This made an accidental global easy to create — a forgotten `<Provider>` would silently land a per-request instance in the shared root, where it persists for the life of the process and (during server render) is shared across every request.

**Breaking:** a State now registers to the root context only when it declares `static readonly global = true`. Without it, a context-less instance is still fully functional but private — not resolvable via `get()` from elsewhere, and never shared across server-render requests. A private instance can still *read* declared globals through the root fallback; it simply isn't one. Scope request state with `<Provider>`, or declare a global for a genuine process-wide singleton (e.g. a router, keyboard, or `localStorage` adapter).

`global` is `readonly` and its inheritance is governed by TypeScript's static-side checks. A bare literal (`static readonly global = true` / `= false`) *seals* the choice: subclasses inherit it and cannot flip it (a `false` floor lets a base author deny descendants from ever becoming global). Widen a subclass's type to `State.Global` to permit an override, or to a resolver — `static readonly global: State.Global<Self> = (self) => …` — which runs at activation with the instance and decides membership dynamically (e.g. per environment). Using a global class inside a `<Provider>` scopes it to that context and never touches the root, so a process-wide default (e.g. `BrowserRouter`) can still be provided per-request.

A declared global is intentional and long-lived — process-wide, mutable, and shared across requests, including on the server. Keep request-specific data out of it: scope that with a `<Provider>` instead. A non-global that a consumer expects to inject but that was never provided still throws the usual `Could not find <State> in context`, so a missing Provider surfaces at the point of use.

`@expressive/router`'s `Router` declares `static readonly global = true` (inherited by `BrowserRouter`), preserving the default single-router behavior under the new rule; an app that navigates during server render should provide its own `Router` per-request.
