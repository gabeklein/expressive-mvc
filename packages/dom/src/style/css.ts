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
 * numbers and the `size` shorthand.
 */
const css = {
  '*': (value: unknown, key: string) => ({ [key]: sized(key, value) }),
  size: (value: style.Value) =>
    Array.isArray(value)
      ? { width: value[0], height: value[1] }
      : { width: value, height: value }
} satisfies macro.Map;

declare module '@expressive/dom' {
  namespace macro {
    interface Registry extends macro.From<typeof css> {}
  }
}

export { css };
