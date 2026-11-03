import { Style } from './stylesheet';
import type { style } from './stylesheet';

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

function sized(property: string, value: unknown, pack: typeof StyleSheet): unknown {
  if (Array.isArray(value))
    return value.map((entry) => sized(property, entry, pack));

  return typeof value == 'number' && value !== 0 && !bare(property)
    ? pack.unit(value)
    : value;
}

function ms(value: Time) {
  return typeof value == 'number' ? `${value}ms` : value;
}

function time(property: string, value: Time | readonly Time[]) {
  return { [property]: typeof value == 'object' ? value.map(ms).join(', ') : ms(value) };
}

type Time = number | string;

/**
 * Web macro pack - numbers sized by `unit` where a property needs one,
 * milliseconds for durations and delays, and the `size` shorthand. Extend it,
 * or use it as is with `StyleSheet.use()`.
 */
class StyleSheet extends Style {
  /** Unit for a number given to a property that needs one; px by default. */
  static unit(value: number) {
    return `${value}px`;
  }

  default(value: unknown, key: string) {
    return { [key]: sized(key, value, this.constructor as typeof StyleSheet) };
  }

  size(value: style.Value) {
    return Array.isArray(value)
      ? { width: value[0], height: value[1] }
      : { width: value, height: value };
  }

  transitionDuration(value: Time | readonly Time[]) {
    return time('transitionDuration', value);
  }

  transitionDelay(value: Time | readonly Time[]) {
    return time('transitionDelay', value);
  }

  animationDuration(value: Time | readonly Time[]) {
    return time('animationDuration', value);
  }

  animationDelay(value: Time | readonly Time[]) {
    return time('animationDelay', value);
  }
}

export { StyleSheet };
