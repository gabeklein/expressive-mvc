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

function sized(property: string, value: unknown): unknown {
  if (Array.isArray(value))
    return value.map((entry) => sized(property, entry));

  return typeof value == 'number' && value !== 0 && !bare(property)
    ? `${value}px`
    : value;
}

function ms(value: Time) {
  return typeof value == 'number' ? `${value}ms` : value;
}

function time(property: string, value: Time | readonly Time[]) {
  return { [property]: typeof value == 'object' ? value.map(ms).join(', ') : ms(value) };
}

function timing(value: Timing) {
  if (typeof value != 'object') return ms(value);

  const { duration, easing, delay } = value;

  return [ms(duration), easing, delay != null && ms(delay)].filter(Boolean).join(' ');
}

function kebab(key: string) {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/^webkit-/, '-webkit-');
}

function deg(value: number | string) {
  return typeof value == 'number' ? `${value}deg` : value;
}

type Time = number | string;

type Timing = Time | { duration: Time; easing?: string; delay?: Time };

type Transitions = { [K in style.Property | 'all' | `--${string}`]?: Timing | false | null };

/**
 * Web macro pack - pixels for numbers where a property needs a unit,
 * milliseconds for `transition`, durations and delays, degrees for `rotate`
 * and `offsetRotate`, and the `size` shorthand. Extend it, or use it as is with `Css.use()`.
 */
class Css extends Style {
  default(value: unknown, key: string) {
    return { [key]: sized(key, value) };
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

  transition(value: string | Transitions) {
    if (typeof value == 'string') return { transition: value };

    const list = Object.entries(value).filter(([, entry]) => entry != null && entry !== false);

    return { transition: list.map(([key, entry]) => `${kebab(key)} ${timing(entry as Timing)}`).join(', ') };
  }

  rotate(value: number | string) {
    return { rotate: deg(value) };
  }

  offsetRotate(value: number | string) {
    return { offsetRotate: deg(value) };
  }
}

export { Css };
