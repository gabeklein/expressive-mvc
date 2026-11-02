---
'@expressive/dom': patch
---

Importing `@expressive/dom` no longer fails to typecheck with circular-type errors in the style macros (`'css' implicitly has type 'any'`, `Type 'Registry' recursively references itself`) in projects that compile its source.
