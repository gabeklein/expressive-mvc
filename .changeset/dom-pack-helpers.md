---
"@expressive/dom": minor
---

`Css` is renamed `StyleSheet`. A pack's `$name` methods are helpers, bound to the pack instance so a macro can destructure them from `this`. A `style()` or `use()` map written as a function receives them, prefix dropped (`style(Heading, ({ rem }) => ({ padding: rem(0.2, 0.45) }))`), and `style.Helpers<App>` types a shared one. `StyleSheet` ships `$rem`, `$em` and `$px`, replacing the `rem`, `em` and `px` exports. Numbers needing a unit go through its `$length` helper (px), which a subclass overrides for another policy, and duration and delay properties take numbers as milliseconds. `media()` is removed - write the condition on a `$name` field (`$mobile = '@media (max-width: 900px)'`).
