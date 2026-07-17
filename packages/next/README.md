# `@expressive/next`

Private compatibility harness for exercising `@expressive/react` against a
real Next.js App Router production build. It does not currently export a Next
adapter or public API.

## Initial contract

The fixture verifies that ordinary client components can use:

- `State.use()` with serializable initial props from a Server Component
- `Provider` and `State.get()` within the client component tree
- `Component` subclasses
- request-time server rendering through `next build` and `next start`
- an async Server Component passed through a client `Provider` boundary
- a server-created Promise streamed into a client component, unwrapped before
  synchronously creating state from its serializable result
- concurrent requests initialized with distinct serializable values

The React package entry advertises its own standard Next.js `'use client'`
boundary. Components which call MVC hooks or define client-owned State classes
must still be client components; Server Components pass them serializable input.

## Known gaps

- Browser hydration and interaction are not covered yet.
- Streaming with state-owned Suspense, Suspense retries, and aborted renders are
  not supported by the current checks.
- State instances are not expected to cross the Server Component serialization
  boundary; pass plain initial values instead.
- React context is client-only. Server-created context must cross as serializable
  props or a Promise of serializable data, then enter an MVC `Provider` in a
  client component.
- Unwrap server-created Promises with React `use()` before calling `State.use()`.
  Suspense from a local `State.use()` instance is rejected with a direct error
  because React may discard its hook state and recreate the instance on retry.
- `React.cache` deduplicates within one server request. Next.js `use cache`
  supports longer-lived caching but requires serializable inputs and outputs;
  neither mechanism makes mutable State instances safe to share across requests.
- Server Functions can cross the boundary as callable references, but ordinary
  methods cannot. Treat every Server Function as a public endpoint with explicit
  input validation and authorization; do not infer RPC semantics from a State
  class.
- `State.use()`, `Provider`, and `Component` prepare fields, props, and context
  during server render, but do not run `new()` or become ready until a client
  commit. Abandoned and server-only render attempts therefore do not start
  mount lifecycle work.
- `use(existingState)` retains its server-render subscription until that external
  state is destroyed.
- Fetch in the Server Component and pass plain initial values, or provide a
  stable async owner and consume it with `State.get()`.

Compatibility fixes discovered here belong in `@expressive/react`. This package
should only gain implementation when behavior is genuinely Next-specific.
