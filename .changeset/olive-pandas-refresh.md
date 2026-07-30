---
'@expressive/react': patch
---

`State.get()` no longer dispatches a React update before its render attempt has committed. A subscriber whose fiber was discarded pre-commit - a sibling mutating shared state during render, under a Suspense boundary that never resolves - called `setState` on a fiber React had not mounted, producing the dev warning *"Can't perform a React state update on a component that hasn't mounted yet."* A change arriving before commit is now held and flushed once the fiber commits, so no update is lost.
