---
"@expressive/dom": minor
---

Macro packs are classes. Extend `Style` (or the shipped `Css`, which replaces `css`) with one method per macro, and `App.use()` returns a `style` whose maps are typed from the class - no `macro.Registry` augmentation. A component's maps resolve against the pack that styled it. Subclasses layer over their base, falling through as before, and `'*'` is a method.

Breaking: `macro()`, `macro.Registry`, `macro.From` and `css` are removed, and with them global rules. Move `macro({ _button: … })` element defaults into a shared map layered as an extra `style()` argument.
