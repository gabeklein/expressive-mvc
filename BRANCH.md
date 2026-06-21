# feat(router): functional/async `redirect` guard (P1 - allow/redirect)

## Scope (P1)

Generalize `Route.redirect` from a static string into a value that also accepts a
function, optionally async, evaluated on **entry** to the route's matched space.
Drives auth-gate / route-guard use in `@expressive/dev` (the generator mapping of
a lowercase `export const redirect` is bun-dev's job, not this branch).

Standalone: **no dependency on #139** (the `redirect()`/`notFound()` sentinel PR).
P1 is a generalization of the existing static-redirect render path, using the
Route's own `fallback`/suspense for async pending.

Origin: `.claude/handoff/redirect-guard-seam.md`.

## API

```ts
redirect?: string | (() => Async<string | void>);
// string          -> redirect there when matched (today's behavior, unchanged)
// () => '' | void  -> allow entry, render normally
// () => '/login'   -> redirect there
// async variant    -> route's `fallback` shows while pending, then allow/redirect
```

`Async<T> = T | Promise<T>` is a **module-local** type alias (not exported public
surface; namespace it only if reuse demands).

## Verdict contract (P1)

Resolved on matched-entry to a normalized internal verdict:
- **string (truthy)** -> redirect: render `<Redirect to={target} replace />`.
- **falsy** (`''` / `undefined` / `void`) -> allow: render the route normally.
- **Promise** -> show `fallback` until it resolves, then apply the above.

`false` / `null` returns are **reserved / unspecified** in P1 - P2 defines them
as force-404 (see below). P1 must not document them as "allow".

## Decisions (agreed)

1. **When it runs.** On the route's scope transitioning to matched (entry), not
   per render. The function is the guard; caching is the deliberate point of it
   being a function rather than a getter.
2. **Caching/invalidation - per matched-entry, dropped on leave:**
   - `matched: false -> true` => run the guard, cache the verdict.
   - navigations *within* the matched space => reuse the cached verdict.
   - `matched: true -> false` (leave) => clear the cache.
   - return to the space => re-run the guard.
3. **Async pending** => the Route's own `fallback` shows, via mvc's native
   suspense (a `set()`/computed read returning a Promise throws suspense until
   resolved). No new pending machinery.
4. **Arbitration.** A guard that *allows* (falsy) must rejoin matching and render
   like a normal route. A static string, or a guard whose verdict is a target,
   stays excluded (the existing `route.redirect` exclusions at
   route.tsx:104/127/295/317 + cedes:317). Replace those truthiness checks with a
   predicate over the resolved verdict: "is this route currently redirecting?" -
   built general so P2's force-404 (another reason to yield) is additive.

## Out of scope (P2, depends on #139)

- **Force-404 / "privileged invisible":** a guard verdict (`false`/`null`) that
  makes the route behave as no-match without navigating - section default/404
  catches, URL unchanged. Reuses #139's `notFound()`/`lost`/`catch()` machinery.
  Deferred deliberately; P1's narrow verdict contract + normalized-verdict
  arbitration keep it additive, no backtrack.
- **Subclass `get redirect()` authoring:** dropped. (The handoff's readonly-field
  concern only bites this path; not needed - declarative prop suffices.)

## Tests (happy-dom harness; pattern from redirect.test.tsx)

- static `redirect` string still redirects when matched (regression).
- sync guard: allow (falsy) renders normally; deny (string) redirects.
- async guard: allow/deny, with `fallback` shown while pending.
- caching: guard runs once per entry; in-space navigations reuse the verdict.
- re-entry: leaving and returning re-runs the guard.
- guard on a Route *with children* (partial match) allows -> children render.

## Release

New `@expressive/router` release; changeset authored at wrap. bun-dev bumps to
consume it and adds the `export const redirect` generator mapping on its side.

## Constraints

- Keep the static-`redirect`-string path backward compatible.
- No new public surface without sign-off (`Async` stays module-local).
- GitButler for VCS writes; conventional commits; no Co-Authored trailers; no
  commits without confirmation.
