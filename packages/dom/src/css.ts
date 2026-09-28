import type { macro, style } from './stylesheet';

const unitless = new Map<string, boolean>();

let probe: CSSStyleDeclaration | undefined;

/**
 * Does the CSSOM accept a bare number for this property? Probed once with a
 * canonical value; the answer is a property of CSS, not of the value.
 */
function bare(property: string) {
  let known = unitless.get(property);

  if (known === undefined) {
    probe ||= document.createElement('div').style;
    (probe as any)[property] = '';
    (probe as any)[property] = 1;
    unitless.set(property, known = Boolean((probe as any)[property]));
  }

  return known;
}

function sized(property: string, value: unknown): unknown {
  if (Array.isArray(value))
    return value.map((entry) => sized(property, entry));

  return typeof value == 'number' && value !== 0 && !bare(property)
    ? `${value}px`
    : value;
}

/**
 * Web macro pack. Register with `macro(css)` to opt into pixel units for
 * numbers and the axis shorthands CSS itself does not provide.
 */
const css = {
  '*': (value: unknown, key: string) => ({ [key]: sized(key, value) }),
  mx: (value: style.Value) => ({ marginLeft: value, marginRight: value }),
  my: (value: style.Value) => ({ marginTop: value, marginBottom: value }),
  px: (value: style.Value) => ({ paddingLeft: value, paddingRight: value }),
  py: (value: style.Value) => ({ paddingTop: value, paddingBottom: value }),
  size: (value: style.Value) =>
    Array.isArray(value)
      ? { width: value[0], height: value[1] }
      : { width: value, height: value }
} satisfies macro.Map;

export { css };
