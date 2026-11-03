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

function sized(property: string, value: unknown, pack: StyleSheet): unknown {
  if (Array.isArray(value))
    return value.map((entry) => sized(property, entry, pack));

  return typeof value == 'number' && value !== 0 && !bare(property)
    ? pack.$length(value)
    : value;
}

function unit(values: number[], suffix: string) {
  return values.map((value) => value + suffix).join(' ');
}

function ms(value: Time) {
  return typeof value == 'number' ? `${value}ms` : value;
}

function time(property: string, value: Time | readonly Time[]) {
  return { [property]: typeof value == 'object' ? value.map(ms).join(', ') : ms(value) };
}

type Time = number | string;

/**
 * Web macro pack - numbers sized by `$length` (px) where a property needs a
 * unit, milliseconds for durations and delays, the `size` shorthand, and
 * `rem`, `em` and `px` helpers. Extend it, or use it as is with
 * `StyleSheet.use()`.
 */
class StyleSheet extends Style {
  default(value: unknown, key: string) {
    return { [key]: sized(key, value, this) };
  }

  $length(value: number) {
    return `${value}px`;
  }

  $rem(...values: number[]) {
    return unit(values, 'rem');
  }

  $em(...values: number[]) {
    return unit(values, 'em');
  }

  $px(...values: number[]) {
    return unit(values, 'px');
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
