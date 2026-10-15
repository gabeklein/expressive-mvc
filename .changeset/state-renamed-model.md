---
'@expressive/mvc': minor
'@expressive/react': patch
'@expressive/dom': patch
---

`State` is renamed `Model`. `State` remains exported as a deprecated alias of the same class, so `extends State`, `instanceof State`, `State.*` namespace types and adapter augmentations keep working; migrate with a find-and-replace. One exception: code that augments the class through `declare module '@expressive/mvc' { interface State { … } }` must augment `Model` instead - augmenting `State` declares a separate interface that shadows the alias's type. `Component.StateProps` is now `Component.ModelProps`, with `StateProps` kept as a deprecated alias.

`@expressive/react` and `@expressive/dom`: error messages and the hot-reload plugin's generated code refer to `Model`.
