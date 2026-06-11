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

## Kill-at-commit (prompt sweep)

Ancestor-pop alone is eventual; #118 criterion 2 wants exactly one live instance at
commit. Fiber position (`_reactInternals` key/index path to root, probed available and
stable at construction) identifies each element's slot. Per ambient context, a slot
holds the ordered list of in-flight instances.

Trigger matters: under React 19 concurrent lanes, construction order alone cannot tell
a stale attempt from one pending commit on another lane - destroying the newest-but-one
at construction killed instances React went on to commit (verified: dead Routes in the
committed tree, commit-phase crash). What is sound: when an instance COMMITS at a slot,
every uncommitted instance constructed BEFORE it there is dead - a parked lane predating
a commit is restarted, never resumed. So: `commit` (useReady) kills older uncommitted
slot-mates and marks the entry owned; `remove` clears it on unmount.

Semantics made explicit: React constructs a fresh instance per attempt (suspense
retries, error-retry passes, StrictMode), so `new()` runs per attempt and its cleanup
now fires when the attempt is killed - previously stale instances leaked undestroyed.
Error-boundary tests updated from shared-mock to per-instance lifecycle tracking.

## Known bounds / open questions

- Discards never retried and never superseded wait for ancestor pop - deterministic,
  previously forever. Orphans directly under `Context.root` live until app teardown.
- Killing instances a live tree still references is only safe with the destroyed-state
  contact contract - #120 landed on main, this branch sits on top of it.
- A discarded attempt's `watch` refresh on a never-mounted fiber logs a benign React
  dev warning ("update on a component that hasn't mounted") - could guard later.
- `subcomponents()` render-phase `watch` on a discarded slot leaks a listener bounded by
  the owner instance's lifetime - unchanged, out of scope.
- Preact/Solid adapters have no class-component bridge; React-specific.

## Tests

`component.test.tsx` discard suite (4 of 5 fail on main):
- `will destroy instance when discarded without retry` - the redirect case.
- `will supersede stale attempts, leaving one live instance at commit` - criterion 2.
- `will not accumulate into parent state across retries` - criterion 3, models the
  router `parent.inner` symptom.
- `will not supersede siblings of the same class` - guards the slot keying.
- `will not accumulate listeners across retries` - guard invariant.

`transition.test.tsx` - router-free harness for the lane scenarios: screen swap inside
`startTransition` with suspense churn; per-child subscriptions across churn and kill.

Integration (examples app, with #120 merged): cold-load NavLinks 136 -> 7 anchors exact,
navigation console 117 errors -> 0 (one benign dev warning).
