# fix/component-commit-leak

Fixes #118 (supersedes the #119 approach).

## Problem

A `Component` is brought fully to life during the React render phase (constructor,
`context.push(this)`, `new()` effects, `watch` subscription) but its teardown was wired
exclusively to the commit phase (`useEffect` unmount calling `from.set(null)`). Any fiber
React discards before commit - a sibling suspends, or navigation redirects away while the
Suspense fallback is showing - never mounts, so teardown never runs.

Probe finding (invalidates #119's premise): React constructs a **fresh instance per
discarded attempt** - there is no instance reuse across Suspense retries. 3 attempts =
3 distinct instances. The leaked listeners live on orphan instances, not the committed
one, so #119's per-instance `pendingStop` closure could never dedupe across attempts.
The real leak is whole orphan instances with live `new()` effects and render side effects.

## Approach: context-owned lifecycle

`Context.pop()` already cascades to all descendant contexts (`scope.forEach(x => x.pop())`),
and every Component already registers a child context in its parent's scope during render.
Discarded instances are already swept structurally - destruction just wasn't attached to
the sweep.

Fix (react/src/component.ts only, no core changes):

- `context` setter: `context.push()` + `context.set(this, () => () => this.set(null))` -
  the instance's own context owns its destruction via the existing `forEach` dispose.
- unmount handler shrinks to `context.pop()` - dispose handles `set(null)`.
- discarded fiber: nearest committed ancestor unmounts -> its `pop()` cascades ->
  orphan contexts pop -> disposes destroy orphan instances.

## Known bounds / open questions

- Sweep promptness: orphans are destroyed when the nearest surviving ancestor context
  pops, not at commit time. During a suspense churn under a long-lived parent, orphans
  (and their render side effects, e.g. router `parent.inner` registrations) stay live
  until that pop. Prompt-sweep options (commit-time sibling sweep) run into the same
  position-keying problem that makes instance reuse infeasible - deferred.
- Orphans directly under `Context.root` live until app teardown - previously forever.
- `subcomponents()` render-phase `watch` on a discarded slot leaks a listener bounded by
  the owner instance's lifetime - unchanged, out of scope.
- Preact/Solid adapters have no class-component bridge; React-specific.

## Tests

- `will destroy instance when discarded without retry` - fails on main, passes here.
- `will not accumulate listeners across retries` - guard invariant (passes on main too,
  since leaked listeners sit on orphans, not the committed instance).
- `will destroy instance exactly once after retries` - idempotence of dispose.
- Full suites green: react 187 pass, mvc 458 pass.
