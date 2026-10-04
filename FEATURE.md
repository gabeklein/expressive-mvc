# @expressive/three

Trunk: `feat/three`. Feature PRs target it; it lands on `main` once release-ready. This file is the agreed scope and shape - update it in the PR that changes either.

## Goal

A three.js scene graph built as an addressable `State` tree. Nodes are classes, behavior lives in their fields and methods, and values reach the three.js object through field writes - no render pass, no prop channel.

## Agreed shape

- **Nodes are `State`**, not `Component`. JSX is at most sugar for props and children - not designed around.
- **Hierarchy is ownership.** A node attaches under the nearest owning `Object3D`, past owners which are not nodes. References (`get()`) and guests (already-active instances) do not attach.
- **Existence is the ownership lifecycle** - field assignment, pool add/delete, destroy. Gating is state, not conditional rendering.
- **Scenes are addressable.** Compose with fields (`turret = new Turret()`) and pools (`enemies = has((e: Mob | Boss) => e)`) on the owning class. A separate manager class only when the population has state of its own (an aggro table). Order is not significant - three sorts draws; `renderOrder` is explicit.
- **Primitives install a fixed member contract at `pre`** through `state.set(key, { get, set })`; the three.js object is the storage. At `pre` a subclass default is still a plain value, so it reaches the object. Primitives declare no instruction fields - a subclass initializer silently replaces those. Instructions are a user tool.
- **Internals are protected** - `_object` (unmanaged; travels with the instance), `create()`.
- **Per-frame work is imperative** - `Frame.each`, dispatching nothing. Reactive state describes what exists; the clock drives what it does.
- **One host-facing root** owns canvas, renderer and camera; nothing else meets a host. Its frame hook is `draw()` - `render` is the host's content method on a rendered State.

## Status

Built: `Object3D`, `Group`, `Scene`, `Mesh`; member contract for `visible`, `position`, `rotation`, `scale`, `geometry`, `material`; `lookAt()`; ownership hierarchy and lifecycle; `Frame`, `loop()`. 100% coverage against real `THREE.Scene` graphs. No pixels rendered yet.

## MVP

- [ ] `children` on `Group` and `Scene` - a pass-through pool, `has((node: Object3D) => node)`: fresh members owned, active ones placed as guests (the missing `add(node)`).
- [ ] Viewport root - renderer, camera, resize, loop, `draw()`.
- [ ] Camera and light nodes.
- [ ] Asset node owning a loaded subtree, named parts as fields.
- [ ] Real-browser verification of what draws, in the vein of `cascade-probe.ts`.
- [ ] Decide whether pointer events (raycasting) are MVP.

## Prerequisites in mvc

- **Public ownership - blocking.** `parent()` is internal; the build imports `@expressive/mvc/state`, outside mvc's `exports`, so the package is not consumable outside the monorepo. Context does not substitute: an owner and everything below it register in the one context the root owner was provided into, so "whose context is this" skips intermediate owners, and `get(State)` resolves nothing (`State` is never a registered key). `@expressive/inspect` rebuilds ownership heuristically for the same reason. Options: a read-only owner accessor; or a context per owner, so context mirrors ownership - which breaks owner-to-descendant lookups (`get(Bar)` from `Baz`) flat contexts allow today.

## Open decisions

- Precedence when a node is both owned and placed in `children` - placement while held, owner on removal.
- `children` on every node, or containers only - a pool per node has a cost.
- `children` validated at `pre` - a subclass redeclaring it throws.
- A subclass computed on a member throws today; it could be synced through an effect instead.

## Bullpen

- Draw only when dirty - setters and attach/detach mark the scene; the loop runs continuously only while `frame.each` handlers exist. Raw `_object` writes outside a handler need explicit invalidation.
- Lazy matrices - `matrixAutoUpdate` off; recompute only subtrees a setter moved.
- Batching static subtrees - merged geometry, `InstancedMesh`, `BatchedMesh`.
- JSX - host-rendered placement as a second attachment source (host-rendered instances have no owner, so no conflict), or reading the element tree directly.
- `def()` layer closure - core, filed separately; not needed here.
- `has<T>()` lists adopting fresh States - documented as non-owning (`has.md`).

## Non-goals

- An r3f-style intrinsic catalogue, prop-driven updates, a second React renderer or context bridge.
