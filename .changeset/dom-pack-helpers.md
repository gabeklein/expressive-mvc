---
"@expressive/dom": minor
---

A pack's `$name` methods are helpers. A `style()` or `use()` map written as a function receives them, prefix dropped (`style(Heading, ({ rem }) => ({ padding: rem(0.2, 0.45) }))`), and `style.Helpers<App>` types a shared one. `Css` ships `$rem`, `$em` and `$px`, replacing the `rem`, `em` and `px` exports. `media()` is removed - write the condition on a `$name` field (`$mobile = '@media (max-width: 900px)'`).
