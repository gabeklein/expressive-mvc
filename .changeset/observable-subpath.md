---
"@expressive/mvc": minor
"@expressive/react": minor
---

Move the low-level observable protocol (`observer`, `touch`, `event`, `listener`, `watch`, `Observer`) off the main entry to a dedicated `@expressive/mvc/observable` subpath. This declutters the primary import surface, which is now the app-facing API (`State`, `Component`, `Context`, instructions). The protocol is power-user surface for building custom observables; import it explicitly:

```ts
import { watch, touch, event } from '@expressive/mvc/observable';
```

Breaking: these names are no longer exported from `@expressive/mvc`, and `@expressive/react` no longer re-exports `Observer` from its main entry. Update imports to the subpath.
