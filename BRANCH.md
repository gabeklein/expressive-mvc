# Route.goto() relative-to-self + anchor base fix

## Goal

`Route.goto()` with no argument navigates *to that Route itself* (its concrete,
params-filled path), assuming the location isn't already there. The headline use
case is "pop from below": a subroute reaches a named ancestor via context
(`this.get(SettingsRoute).goto()`) and navigates up to it as currently
identified. Calling on different Routes selects the from-point, uniformly.

Unified model: **`goto` always resolves its argument relative to the Route it's
called on; absent argument means `"."` (here).** No overloads, no special pop
path. `''`/`'.'` stop being dead no-ops.

## Decisions

- Explicit re-identify (`goto({ id: 6 })`, different params than current) is out
  of scope; express relatively (`goto('../6')`) for now. Revisit as convenience
  if needed - an object would just map to that relative form.
- Bare `goto()` on an *unmatched* param'd Route **throws** a clear message
  (relative nav from a Route not on the current path is meaningless).
- Pushed URL strips the trailing slash (`/posts/5`, not `/posts/5/`) to match the
  canonical form stored elsewhere.

## Preexisting issues this corrects

Probing `/posts/foo/edit` under `<Route to="/posts/:id"><Route to="edit"/></Route>`:

1. **Param'd ancestor carries no captures.** `match` requires an exact
   segment-count match, so `/posts/:id` does not match `/posts/foo/edit` -
   `post.match` is `undefined`. The `:id=foo` identity lives in `router.path`,
   not on the ancestor. The old `anchor` filled params from `route.match!`, so
   "pop from below" would throw.
2. **`anchor` ignored `base`.** It only read `route.to`, so `leaf.anchor` was
   `'edit/'` - dropping `/posts/:id`. Relative nav from any *nested* route was
   already base-less; only top-level relative-nav was tested, hiding it.

## Approach

Reframe `anchor` around the live path instead of `match`:

> the concrete anchor of a Route is the prefix of `router.path` that the Route's
> own pattern (`route.path`, which already includes `base`) claims, with
> `:param` segments taking their value from the corresponding path segment.

- Add internal `fillPath(pattern, path)` to `url.ts` (not re-exported from
  `index.ts`, so not public surface): returns the concrete claimed prefix, or
  `null` when literals disagree / path is shorter than pattern.
- `Router.anchor` = `fillPath(route.path, this.path) ?? route.path` + trailing
  `/`. It must stay **total** - mvc evaluates it as a reactive getter eagerly,
  so a throw there crashes render for every off-path Route (e.g. NavLinks). Off
  the current path it falls back to the Route's own (base-composed) pattern with
  `:params` unfilled. Drops the `route.match!` dependency - a net simplification
  plus the base fix.
- `Route.goto(url = '.', replace?)`: resolve, then throw if the resolved path
  still carries an unresolved `:param` (the unmatched case), strip trailing
  slash, navigate.

## Tests

- bare `goto()` pops to a param'd ancestor from below (`/posts/foo/edit` ->
  `/posts/foo`)
- bare `goto()` on exactly-matched leaf
- relative nav from a *nested* route now composes base correctly (regression for
  issue 2)
- bare `goto()` on unmatched param'd Route throws
- existing relative/absolute goto tests stay green
