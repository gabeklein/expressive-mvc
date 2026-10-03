---
"@expressive/dom": minor
---

PascalCase methods are no longer rewritten into subcomponents. A PascalCase method of any State or Component becomes a subcomponent when rendered as an element (`<this.Label />`, or passed on and rendered elsewhere). It tracks its owner wherever it renders, and keeps its state across a hot patch or a `set()` override. Called directly, it stays a plain method. A PascalCase function field is plain data and renders as an ordinary function component.
