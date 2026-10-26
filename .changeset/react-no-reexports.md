---
'@expressive/react': minor
---

**Breaking:** the deprecated re-exports are gone - `Model`, `State`, the default export, `Component`, `Context`, `def`, `get`, `has`, `map`, `ref`, `set` and `pending`. `@expressive/react` now exports nothing for app code: import it once for its side effect and take everything from `@expressive/mvc`.

```ts
// before
import Model, { Component, get } from '@expressive/react';

// after
import '@expressive/react';
import { Model, Component, get } from '@expressive/mvc';
```
