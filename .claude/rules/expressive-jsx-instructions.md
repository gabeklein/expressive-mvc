# Expressive JSX - Instructions Reference

Instructions use `$name: { ... }` syntax to apply CSS pseudo-selectors, media queries, and combinators.

## Pseudo-Classes

| Instruction | CSS |
|---|---|
| `$hover` | `:hover` |
| `$focus` | `:focus` |
| `$active` | `:active` |
| `$visited` | `:visited` |
| `$disabled` | `:disabled` |
| `$checked` | `:checked` |
| `$link` | `:link` |
| `$anyLink` | `:any-link` |
| `$focusVisible` | `:focus-visible` |
| `$focusWithin` | `:focus-within` |
| `$placeholderShown` | `:placeholder-shown` |
| `$default` | `:default` |
| `$enabled` | `:enabled` |
| `$readOnly` | `:read-only` |
| `$readWrite` | `:read-write` |
| `$required` | `:required` |
| `$optional` | `:optional` |
| `$valid` | `:valid` |
| `$invalid` | `:invalid` |
| `$inRange` | `:in-range` |
| `$outOfRange` | `:out-of-range` |
| `$firstChild` | `:first-child` |
| `$lastChild` | `:last-child` |
| `$firstOfType` | `:first-of-type` |
| `$lastOfType` | `:last-of-type` |
| `$onlyChild` | `:only-child` |
| `$onlyOfType` | `:only-of-type` |
| `$empty` | `:empty` |

## Pseudo-Elements

| Instruction | CSS |
|---|---|
| `$before` | `::before` |
| `$after` | `::after` |
| `$firstLine` | `::first-line` |
| `$firstLetter` | `::first-letter` |
| `$selection` | `::selection` |
| `$placeholder` | `::placeholder` |

## Breakpoints (min-width media queries)

| Instruction | CSS |
|---|---|
| `$sm` | `@media (min-width: 640px)` |
| `$md` | `@media (min-width: 768px)` |
| `$lg` | `@media (min-width: 1024px)` |
| `$xl` | `@media (min-width: 1280px)` |

## Color Scheme

| Instruction | CSS |
|---|---|
| `$dark` | `@media (prefers-color-scheme: dark)` |
| `$light` | `@media (prefers-color-scheme: light)` |

## Combinators

| Instruction | CSS |
|---|---|
| `$children` | ` > *` |
| `$even` | `:nth-child(even)` |
| `$odd` | `:nth-child(odd)` |

## Nesting

All instructions can nest within each other:

```jsx
$md: {
  $hover: {
    color: 0xff0000;
  }
}
// -> @media (min-width: 768px) { .Component:hover { color: #ff0000 } }
```
