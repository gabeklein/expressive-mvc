# @expressive/three

Trunk: `feat/three`. Feature PRs target it; it lands on `main` once release-ready. This file is the agreed scope and shape - update it in the PR that changes either.

## Goal

A three.js scene graph built as an addressable `State` tree. Nodes are classes, behavior lives in their fields and methods, and values reach the three.js object through field writes - no render pass, no prop channel. The State tree's main value is the address space - scenes are found, referenced and composed by class; reactivity serves discrete state, and animation opts out.

## Agreed shape

- **Nodes are `State`**, not `Component`. JSX is at most sugar for props and children - not designed around.
- **Placement defaults to ownership.** Ownership (`get(State)`) is lifetime; placement is where a node draws. Unplaced, a node attaches under the nearest owning `Object3D`, past owners which are not nodes. References (`get()`) and guests (already-active instances) do not attach. `parent` places explicitly - a node, `null` for nowhere, or an instruction (`parent = get(World)`); it stays out of the store, so the node held there is not adopted. `children` is the read view, one parent at a time. Placement never touches lifetime - pools spawn by placing and despawn by unplacing; a destroyed parent returns its placed nodes to their owner. Only edges between our nodes are managed; three never writes back.
- **Existence is the ownership lifecycle** - field assignment, pool add/delete, destroy. Gating is state, not conditional rendering.
- **Scenes are addressable.** Compose with fields (`turret = new Turret()`) and pools (`enemies = has((e: Mob | Boss) => e)`) on the owning class. A separate manager class only when the population has state of its own (an aggro table). Order is not significant - three sorts draws; `renderOrder` is explicit.
- **Primitives install a fixed member contract at `setup`** through `state.set(key, { get, set })`; the three.js object is the storage. Transforms (`position`, `rotation`, `scale`) read as the live three.js vector and follow expressive's in-place rule - assigning a vector copies it in and dispatches if changed, mutating in place is silent, `set('position')` announces. Assign to place, mutate to animate. Vectors only - no tuple form. At `setup` a subclass default is still a plain value, so it reaches the object. Primitives declare no instruction fields - a subclass initializer silently replaces those. Instructions are a user tool.
- **Internals are protected** - `_object`, `create()`. `_object` is a getter over a module-private store; reaching it marks the node, and `draw()` checks marked nodes' structure - a node moved there instead of through `parent` warns once and goes back, unless it now sits under a foreign object (a loaded bone). Values in frame handlers go through members; structure and lifecycle never go through `_object`. The base is generic (`Object3D<T>`), so `_object` is typed per subclass.
- **Per-frame work is imperative** - `Frame.each` mutating live vectors (`this.rotation.y += …`), dispatching nothing. A dispatch costs ~1.7µs per write against ~9ns in place, so continuous motion mutates. Reactive state describes what exists; the clock drives what it does.
- **One host-facing root** - `Viewport` owns the renderer and a `Frame`; a subclass supplies `scene` and `camera`. It never renders anything itself: a host hands it a surface - `attach(canvas | gl)`, or `<canvas ref={viewport.canvas} />` - so the package carries no host code. React Native's `GLView` passes a context the same way. Its frame hook is `draw()` - `render` is the host's content method on a rendered State. Drawing is continuous while attached.

## Status

Built: `Object3D`, `Group`, `Scene`, `Mesh`; member contract for `visible`, `geometry`, `material`, and live-vector transforms; `lookAt()`; placement (`parent`, `children`) defaulting to ownership; lifecycle; `Frame`, `loop()`; `Viewport`, `PerspectiveCamera`; guarded `_object`. 100% coverage against real `THREE.Scene` graphs; drawing verified in Chrome by `three-probe.ts`.

## MVP

- [x] Placement - `parent` and `children` (see Agreed shape).
- [x] Guarded `_object` (see Agreed shape).
- [x] Viewport root - renderer, resize, loop, `draw()`.
- [ ] Camera and light nodes - `PerspectiveCamera` done; orthographic camera and lights remain.
- [ ] Asset node owning a loaded subtree, named parts as fields. A wrapped part's unset `parent` keeps wherever the loaded graph put it.
- [x] Real-browser verification - `bun .github/scripts/three-probe.ts` draws in Chrome and reads back pixels.
- [ ] Decide whether pointer events (raycasting) are MVP.

## Prerequisites in mvc

- **Public ownership** - done (#460). The owner walk uses `get(State, false)`; the build imports only `@expressive/mvc`.
- **Field `get()` of a distant ancestor** - done (#466). `parent = get(World)` resolves in a host-less scene.

## Open decisions

- A subclass computed on a member throws today; it could be synced through an effect instead.

## Bullpen

- Pausing - tabled until realistic scene structures exist. Few interactive scenes want to stop between interactions (idle animations, fidgets, particles), so a user-driven pause likely beats automatic invalidation. Silent transform mutation leaves no trace; any automatic scheme would rest on frame handlers implying continuous drawing.
- Dev warning when a node's transform is assigned on many consecutive frames - animate by mutating in place.
- React Native entry or recipe - `GLView` context, `endFrameEXP()` after each draw, resize and frame pacing without `ResizeObserver`.
- A host Component rendering its own `<canvas>` and sizing wrapper - per host, once a standalone canvas exists.
- Tuple form for transforms (`position = [0, 1, 0]`) - needs mvc's `State.Assign` to honour setter types (new public type), or stays out.
- World-preserving reparent (three's `attach`) as a node method; pooling helpers.
- Lazy matrices - `matrixAutoUpdate` off; recompute only subtrees a setter moved.
- Batching static subtrees - merged geometry, `InstancedMesh`, `BatchedMesh`.
- JSX - host-rendered placement as a second attachment source (host-rendered instances have no owner, so no conflict), or reading the element tree directly.
- `def()` layer closure - core, filed separately; not needed here.

## Non-goals

- An r3f-style intrinsic catalogue, prop-driven updates, a second React renderer or context bridge.
