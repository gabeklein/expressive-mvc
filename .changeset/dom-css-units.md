---
"@expressive/dom": minor
---

`Css` gains macros for properties where px is wrong: `transitionDuration`, `transitionDelay`, `animationDuration` and `animationDelay` take numbers as milliseconds, and `rotate` takes degrees. The `rem`, `em`, `px` and `media` exports are removed - write other units as strings, and conditions on a `$name` field (`$mobile = '@media (max-width: 900px)'`).
