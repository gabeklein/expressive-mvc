# Expressive JSX - Macros Reference

Macros are shorthand properties that expand into multiple CSS declarations. Provided by `@expressive/css`.

## Position

| Macro | Signature | Output |
|---|---|---|
| `absolute` | `absolute: fill` / `absolute: top, right, bottom, left` | `position: absolute` + edge values. `fill` = all edges 0 |
| `fixed` | `fixed: fill` / `fixed: top, right, bottom, left` | `position: fixed` + edge values |
| `relative` | `relative` | `position: relative` |

## Size

| Macro | Signature | Output |
|---|---|---|
| `size` | `size: width, height` | `width` + `height` (height defaults to width) |
| `minSize` | `minSize: width, height` | `min-width` + `min-height` |
| `maxSize` | `maxSize: width, height` | `max-width` + `max-height` |
| `aspectSize` | `aspectSize: width, height` | `width` + `height` with aspect-ratio scaling |
| `circle` | `circle: diameter` | `border-radius: 50%; width; height` |

## Border

| Macro | Signature | Output |
|---|---|---|
| `border` | `border: color` / `border: color, width` / `border: color, style, width` | `border: <width>px <style> <color>` |
| `borderTop` / `borderT` | Same as border | `border-top: ...` |
| `borderBottom` / `borderB` | Same as border | `border-bottom: ...` |
| `borderLeft` / `borderL` | Same as border | `border-left: ...` |
| `borderRight` / `borderR` | Same as border | `border-right: ...` |

## Radius

| Macro | Signature | Output |
|---|---|---|
| `radius` | `radius: value` / `radius: direction, r1, r2` | `border-radius` (directional: top, left, right, bottom) |

## Spacing

| Macro | Signature | Output |
|---|---|---|
| `margin` | `margin: values...` | Shorthand margin |
| `padding` | `padding: values...` | Shorthand padding |
| `marginTop` / `marginT` | `marginT: value` | `margin-top` |
| `marginBottom` / `marginB` | `marginB: value` | `margin-bottom` |
| `marginLeft` / `marginL` | `marginL: value` | `margin-left` |
| `marginRight` / `marginR` | `marginR: value` | `margin-right` |
| `marginHorizontal` / `marginH` | `marginH: v1, v2?` | `margin-left` + `margin-right` |
| `marginVertical` / `marginV` | `marginV: v1, v2?` | `margin-top` + `margin-bottom` |
| `paddingTop` / `paddingT` | `paddingT: value` | `padding-top` |
| `paddingBottom` / `paddingB` | `paddingB: value` | `padding-bottom` |
| `paddingLeft` / `paddingL` | `paddingL: value` | `padding-left` |
| `paddingRight` / `paddingR` | `paddingR: value` | `padding-right` |
| `paddingHorizontal` / `paddingH` | `paddingH: v1, v2?` | `padding-left` + `padding-right` |
| `paddingVertical` / `paddingV` | `paddingV: v1, v2?` | `padding-top` + `padding-bottom` |

## Layout

| Macro | Signature | Output |
|---|---|---|
| `flexAlign` | `flexAlign: justify, align?` / `flexAlign: direction, justify, align` | `display: flex` + direction/justify/align |
| `gridArea` | `gridArea: row, col` | `grid-row` + `grid-column` |
| `gridRow` | `gridRow: start, end?` | `grid-row` |
| `gridColumn` | `gridColumn: start, end?` | `grid-column` |
| `gridRows` | `gridRows: template...` | `display: grid` + `grid-template-rows` |
| `gridColumns` | `gridColumns: template...` | `display: grid` + `grid-template-columns` |

## Visual

| Macro | Signature | Output |
|---|---|---|
| `shadow` | `shadow: color, radius?, x?, y?` | `box-shadow` (defaults: radius=10, x=0, y=0) |
| `background` / `bg` | `background: color` | `background-color` or `background` |
| `transform` | `transform: functions...` | `transform: ...` |

## Scalar Overrides

These macros override default unit handling for specific properties (integers -> px instead of default behavior):

`gap`, `top`, `left`, `right`, `bottom`, `width`, `height`, `maxWidth`, `maxHeight`, `minWidth`, `minHeight`, `fontSize`, `lineHeight`, `outlineWidth`, `borderRadius`, `backgroundSize`
