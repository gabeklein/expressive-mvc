---
"@expressive/mvc": minor
"@expressive/react": minor
---

Seal root-registered state as read-only during server render, preventing cross-request state bleed.

A `State.new()` created outside a Provider registers into the process-global root context. On the client this is a per-app singleton, but during server render the module — and its root — is shared across every request, so a per-request mutation to such a state would leak between users.

The React adapter now enables `Context.sealing` when no DOM is present (a server render). While sealing is on, any state registered to the root context is sealed on activation: value-carrying writes (assignment, `.set(...)`, async factory resolution) are squashed to a no-op, with a one-time dev-only warning per property. Reads, computed getters (silent internal writes), and context membership are unaffected, so existing read-only defaults keep rendering.

Request-scoped state — `State.use()` and `<Provider>` instances — lives outside the root context and is never sealed, so per-request mutation there continues to work. State created on the client is unchanged.
