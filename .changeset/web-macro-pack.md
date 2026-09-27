---
"@expressive/dom": minor
---

Ship `css`, a web macro pack. `macro(css)` opts into pixel units for numbers and the axis shorthands CSS does not provide - `mx`, `my`, `px`, `py` and `size`.

Units come from the CSSOM rather than a hardcoded list: a property is probed once with a canonical value and the answer cached, so `zIndex`, `lineHeight` and `fontWeight` keep bare numbers while lengths and logical properties get `px`, including every entry of a sequence (`margin: [1, 2]` is `1px 2px`). The terminal itself still never guesses - without the pack a rule needs `padding: '8px'`.

The pack is deliberately small. CSS already has shorthands, and arrays plus units cover them; only the axis pairs, which CSS lacks entirely, and `size` earn a macro.
