---
'@expressive/react': minor
---

**Breaking:** the deprecated re-exports are gone - `Model`, `State`, the default export, `Component`, `Context`, `def`, `get`, `has`, `map`, `ref`, `set` and `pending`. `@expressive/react` now exports nothing for app code: import it once for its side effect and take everything from `@expressive/mvc`.

The one thing left on the entry is a type-only `Runtime` re-export, which keeps its declarations linked to the adapter's `Model` and `Component` augmentations; nothing is exported at runtime.

```ts
// before
import Model, { Component, get } from '@expressive/react';

// after
import '@expressive/react';
import { Model, Component, get } from '@expressive/mvc';
```
