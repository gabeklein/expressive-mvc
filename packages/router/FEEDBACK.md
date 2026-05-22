# Router MVP - Feedback & Next Steps

> Review notes on the current MVP of `@expressive/router`. The MVP matches `PLAN.md` cleanly; this doc captures gaps to close before a file-based router (in `expressive-dev`'s `bun-dev`) can codegen against this package.

## Context

The MVP implements PLAN.md steps 1-6 correctly: matcher (literal + `:param`), Router (path + popstate + `goto` + sibling resolution via JSX inspection), Route (`to`/`as`/`match`/`params`/`anchor`/relative `goto`), Link (relative-aware `href` + modifier semantics), Redirect, and update-in-place default. ~170 LOC, tests passing.

What follows are (A) gaps that block file-based routing, (B) design nits worth resolving while in the area, and (C) the order to land them in. None of this requires re-litigating PLAN.md decisions.

## A. Gaps blocking file-based routing

A file-based router codegens a tree like:

```tsx
<Router>
  <Route to="/" as={RootLayout}>
    <Route as={HomePage} />
    <Route to="blog/*" as={BlogLayout}>
      <Route as={BlogIndex} />
      <Route to=":slug" as={BlogPost} />
    </Route>
    <Route to="*" as={NotFound} />
  </Route>
</Router>
```

For that to work, three things must land:

### A1. Nested route resolution (PLAN step 2)

When a Route's `as` is a layout (Component that renders `{children}`), the Route must resolve *its own* Route children against the current path under its `base`, mount the winner, and pass it as `children` to `as`.

Implementation sketch:

- Extract the JSX-inspection resolver currently inlined in `Router.render` into a shared helper, e.g.

  ```ts
  // matcher.ts (or a new resolver.ts)
  export function resolveChild(
    children: ReactNode,
    basePath: string,
    path: string
  ): ReactElement | null
  ```

- `Router.render` calls `resolveChild(children, '', this.path)`.
- `Route.render` calls `resolveChild(props.children, this.base + this.segment, this.router.path)` when it has Route children, and injects the result as `children` into `as`.
- Add `base` and `segment` getters on Route per PLAN.md ("Route" section). `Route.match` then uses `this.base + this.to` (not `this.to`).

Tests: nested layout matches prefix, mounts `as` with resolved child as `children`; layout doesn't mount when out of prefix; deep nesting (3+ layers) works; sibling Routes inside a layout resolve independently.

### A2. Catch-all in matcher (PLAN step 4)

Add `*` support:

- `to="*"` matches any path at this level. Captured as `params['*']`.
- `to="blog/*"` matches `/blog` and `/blog/**`; the `*` portion captured as `params['*']` (empty string if exact).
- Always loses to more-specific siblings (see A3).

Tests: bare `*`, prefixed `*`, empty capture, multi-segment capture.

### A3. Specificity ordering for multi-match

Once nested layouts + catch-all exist, multiple siblings can match the same path. Resolver picks the most specific:

1. Exact literal match
2. `:param` segments (more params = less specific; literal segments break ties)
3. `*` (catch-all)

Ties at the same specificity break by document order (first-declared wins). The existing "first match wins" loop in `Router.render` works for ordered cases but won't give correct results once `*` and `:param` coexist as siblings - it'd pick whichever is declared first, even if a more-specific sibling exists later. The shared resolver from A1 should sort candidates before returning.

Tests: `:param` beats `*`; literal beats `:param`; document-order tiebreak; a `to="*"` declared *first* still loses to a literal sibling declared later.

## B. Design nits

### B1. Extract `matcher.ts`

`matchPattern` currently lives in `router.ts`. Once A2 + A3 land it grows past inline size. Extract into `src/matcher.ts` per PLAN.md package layout, with `resolveChild` if you take the shared-helper approach.

### B2. `Redirect` should fire in `new()`, not `render()`

Current:

```ts
render() {
  if (!this.fired && this.when) {
    this.fired = true;
    this.route.goto(this.to, this.replace);
  }
  return null;
}
```

`new()` runs once per mount and is StrictMode-safe per Component conventions. The `fired` flag exists only because render can run multiple times - `new()` removes the need:

```ts
protected new() {
  if (this.when) this.route.goto(this.to, this.replace);
}
render() { return null; }
```

Keep the `when` semantics: when `when` is `false` at mount, don't navigate. Reactive flips of `when` after mount are *not* required to fire (matches the "fires on mount" mental model). Document this so a later contributor doesn't try to "fix" it.

### B3. `Link` and `Redirect` ancestor requirement

Both currently `get(Route)` (required). This forbids top-level usage (e.g. a global nav sidebar above any Route). Two valid stances:

- **Required (current):** explicit, keeps relative-path semantics unambiguous. Document the constraint.
- **Optional with Router fallback (per PLAN.md):** `get(Route, false)` and `(this.route ?? this.router).goto(...)`. Slightly more permissive; relative paths from outside any Route fall back to `Router` which rejects them (already does).

Pick one deliberately and document. The Router-fallback option is more ergonomic for top-level UI; the strict option forces all navigation through a Route, which is a defensible discipline. I'd take Router-fallback - the cost is two `?? this.router` clauses, the benefit is "Link works wherever the user expects."

### B4. `Route.params` reactive identity

PLAN.md specifies `params` returns a memoized object stable across renders with unchanged params. Current implementation returns a fresh object on every read (`this.match?.params ?? {}`), since `match` recomputes. Acceptable for v1, but downstream consumers using `params` in `useEffect` deps or `===` checks will get false positives. Memoize once stable.

Not blocking file-based routing - flagging for future work.

## C. Order of work

Each step ships green tests before the next begins. Per mvc policy: each test must fail without its implementation.

1. **Extract `matcher.ts`.** Move `matchPattern` + helpers. No behavior change. Tests stay green.
2. **Add catch-all to matcher (A2).** New matcher tests for `*` patterns.
3. **Add `base` + `segment` getters on Route.** No behavior change yet (only `Route.match` consumers see it, and they're not the resolver).
4. **Extract `resolveChild` (A1 part 1).** Move the JSX-inspection loop out of `Router.render`. Add specificity ordering (A3). Router tests updated to cover `:param` vs `*` siblings.
5. **Nested resolution (A1 part 2).** `Route.render` calls `resolveChild` when it has Route children. Add tests: layout with index + dynamic child, layout doesn't mount out of prefix, three-level nesting.
6. **Fix `Redirect` to use `new()` (B2).** Tests for StrictMode double-mount, `when={false}` suppressing fire.
7. **Decide and apply B3** (Link/Redirect ancestor). Tests for top-level usage either way.
8. **(Optional) `Route.params` memoization (B4).** Stable identity test.

After step 5, file-based routing has everything it needs from this package.

## D. Out of scope (don't touch)

- Loader / action API (PLAN: page concern).
- `redirect()` / `notFound()` sentinels (PLAN iteration step 5; lands separately).
- Search params (PLAN iteration step 1; lands separately).
- `NavLink`, prefetching, scroll restoration, hash/memory router (PLAN iteration steps 6-8).
- Multi-renderer split. React-only for now.
- File-based routing codegen itself - lives in `expressive-dev`, consumes this package as-is.
- PLAN.md decisions: don't reopen update-in-place, directory anchor, single-winner resolution, JSX-tree resolution. They were settled.

## Acceptance criteria

When this work is complete, the example tree at the top of section A renders correctly:

- `/` -> `<RootLayout><HomePage /></RootLayout>`
- `/blog` -> `<RootLayout><BlogLayout><BlogIndex /></BlogLayout></RootLayout>`
- `/blog/hello-world` -> `<RootLayout><BlogLayout><BlogPost /></BlogLayout></RootLayout>` with `Route.get().params.slug === 'hello-world'`
- `/anything-else` -> `<RootLayout><NotFound /></RootLayout>`
- Navigating `/blog/a` -> `/blog/b` preserves `BlogPost` instance (update-in-place still holds)
- Coverage still 100%, `tsc --noEmit` clean.
