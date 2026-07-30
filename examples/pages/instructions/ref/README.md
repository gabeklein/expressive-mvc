# Refs

`ref` is the `useRef` replacement: a slot for a value that lives outside the
render data - here, the DOM node being dragged.

## What to try

Drag the box around the surface. It clamps at the edges, and dragging fast
enough to outrun the pointer still tracks.

## What it teaches

**The callable form captures the node.** Passing `this.box` to `ref=` stores
the element; `this.box.current` reaches it later. One field replaces the
`useRef` + `useEffect` pair.

**Position is ordinary state.** `x` and `y` are plain reactive fields, so the
box simply follows the numbers. The ref is only there for the one thing state
cannot answer: the node's measured geometry.

**Handlers are methods.** `grab`, `move` and `drop` are declared methods
passed straight to the element - no arrow wrappers, no `useCallback`, and no
stale closure over the drag offset.

## Where to look next

- **ref (proxy)** hands back one callable ref per field in a single call.
- **set** manages a field's value rather than a slot beside it.
