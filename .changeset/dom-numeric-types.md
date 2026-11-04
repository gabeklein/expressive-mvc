---
"@expressive/dom": minor
---

`Css` gains `transition`, which gives every number milliseconds, and `offsetRotate`, which takes degrees. Maps accept a number only for properties where one is valid CSS, so `color: 5`, `animation: ['spin', 1]` or `flex: [1, 1, 200]` is a type error; a map for a pack without `default`, plain `style()` included, accepts only unitless numbers and `0`.
