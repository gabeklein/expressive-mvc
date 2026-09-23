---
"@expressive/jsx": minor
---

Register component and global style maps. Object entries are rules - static blocks applied by host tag, child component name, or `_rule`, each emitted as one class named after its source. Function entries are macros, usable inside rule bodies or as `_macro={value}`; an element's macro calls form one location class per site (its position in the component's output, shared across mapped list rows), and differing values move inline property by property. Caller rules travel as tokens through `style` and outrank the callee's by the number of component doors crossed, independent of emission order.
