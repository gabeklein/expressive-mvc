---
"@expressive/jsx": minor
---

Register component and global style maps. A `_name` entry is a rule, applied by a truthy `_name` attribute and emitted as one class named after its source; nested inside a rule it opens a descendant scope. Bare keys are declarations or macro calls, and those at the top of a map form a base rule applied to each of the component's host roots. Macros layer: a key resolves at its topmost definition, and one returning its own name falls to the next definition down, then through any `'*'` handler. Unhandled keys reach the host terminal, which joins arrays and rejects functions and objects. Caller rules travel as tokens through `style` and outrank the callee's by the number of component doors crossed, independent of emission order.
