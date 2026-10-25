---
'@expressive/mvc': minor
---

An `is` callback's returned object is assigned to the instance, once, before `new()` - a seed, where props reassign every render: `<Counter is={() => ({ count: start })} />`. The same holds for `<Component for={Type} is>`.

**Breaking (types):** `is` is typed `(instance) => Model.Assign<T> | void`. A concise arrow capturing the instance returns it and no longer type-checks - discard the result with `void` or braces:

```tsx
<Counter is={(c) => void (counter = c)} />
```

**Fix:** a constructor callback returning anything other than a plain object - the instance itself, a `Map` - is no longer assigned. `Model.new((self) => (held = self))` threw on read-only fields such as `map()`.
