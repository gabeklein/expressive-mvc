import { sinking } from './protocol';
import { Style } from './stylesheet';
import type { style } from './stylesheet';

const unitless = new Map<string, boolean>();

let probe: CSSStyleDeclaration | undefined;

/**
 * Does the CSSOM accept a bare number for this property? Probed once with a
 * canonical value; the answer is a property of CSS, not of the value.
 */
function bare(property: string) {
  const sink = sinking();

  if (sink) return sink.unitless(property);

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
 * The web macro pack - units for bare numbers, ms for times, degrees for rotation, `size`.
 *
 * A number gets `px` only where the property needs a unit. Extend it with macros, or use it as is with `Css.use()`.
 */
class Css extends Style {
  default(value: unknown, key: string) {
    return { [key]: sized(key, value) };
  }

  /** `width` and `height` - one value for both, or `[width, height]`. */
  size(value: style.Value) {
    return Array.isArray(value)
      ? { width: value[0], height: value[1] }
      : { width: value, height: value };
  }

  /** A number is milliseconds; a list joins with commas. */
  transitionDuration(value: Time | readonly Time[]) {
    return time('transitionDuration', value);
  }

  /** A number is milliseconds; a list joins with commas. */
  transitionDelay(value: Time | readonly Time[]) {
    return time('transitionDelay', value);
  }

  /** A number is milliseconds; a list joins with commas. */
  animationDuration(value: Time | readonly Time[]) {
    return time('animationDuration', value);
  }

  /** A number is milliseconds; a list joins with commas. */
  animationDelay(value: Time | readonly Time[]) {
    return time('animationDelay', value);
  }

  /**
   * Transitions keyed by property - `{ opacity: 200, transform: { duration: 300, easing, delay } }`.
   *
   * Times are milliseconds. A string passes through; `false` or `null` drops an entry.
   */
  transition(value: string | Transitions) {
    if (typeof value == 'string') return { transition: value };

    const list = Object.entries(value).filter(([, entry]) => entry != null && entry !== false);

    return { transition: list.map(([key, entry]) => `${kebab(key)} ${timing(entry as Timing)}`).join(', ') };
  }

  /** A number is degrees. */
  rotate(value: number | string) {
    return { rotate: deg(value) };
  }

  /** A number is degrees. */
  offsetRotate(value: number | string) {
    return { offsetRotate: deg(value) };
  }
}

export { Css };
