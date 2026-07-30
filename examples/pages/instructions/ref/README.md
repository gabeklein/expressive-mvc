# Refs

`ref` is the `useRef` replacement - a slot for a value outside the render data,
here the node being dragged. Its callable form captures the element and
`.current` reaches it, replacing the usual `useRef` and `useEffect` pair.

Position is ordinary state, so the box just follows `x` and `y`; the ref exists
only for the one thing state cannot answer, which is measured geometry.
Handlers are declared methods passed straight to the element - no
`useCallback`, no stale closure over the drag offset.
