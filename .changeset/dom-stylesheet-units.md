---
"@expressive/dom": minor
---

`Css` is renamed `StyleSheet`. A number given to a property that needs a unit goes through its `static unit` (px), which a subclass overrides for another policy (`static unit(n: number) { return `${n}rem`; }`). Duration and delay properties take numbers as milliseconds. The `rem`, `em`, `px` and `media` exports are removed - write other units as strings, and conditions on a `$name` field (`$mobile = '@media (max-width: 900px)'`).
