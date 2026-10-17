import * as appearance from './appearance';

type Member = Extract<keyof CSSStyleDeclaration, string>;

type Settable = {
  [K in Member]-?: CSSStyleDeclaration[K] extends Function ? never : K;
}[Member];

type Key =
  | style.Property
  | keyof macro.Registry
  | `--${string}`
  | `_${string}`;

type Argument<K extends keyof macro.Registry> =
  macro.Registry[K] extends (value: infer A, ...rest: any[]) => any ? A : never;

declare namespace macro {
  /**
   * Macros visible to a style map. A pack augments this interface to declare
   * what it registers with `macro()`.
   */
  interface Registry {}

  /** Maps one argument to style, or to keys which resolve further. */
  type Fn = (value: any, key: string) => unknown;

  /**
   * Body of a `macro()` map. A name declared in {@link Registry} must match its
   * declaration; an undeclared one is accepted, and becomes checkable at call
   * sites once a module augments `Registry` with it.
   */
  type Map =
    & Partial<Registry>
    & { [K in `_${string}`]?: style.Map }
    & Record<string, Fn | style.Map | undefined>;
}

declare namespace style {
  /** CSS property names, minus the CSSOM's own members. */
  type Property = Exclude<Settable, 'length' | 'parentRule' | 'cssText'>;

  /** What a declaration or macro argument may be; never a plain object. */
  type Value =
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly Value[];

  /**
   * Body of a `style()` map. Bare keys are declarations or macro calls,
   * `_name` opens a rule or descendant scope, and `$name` is reserved.
   */
  type Map = {
    [K in Key]?:
      K extends `_${string}` ? Map :
      K extends keyof macro.Registry ? Argument<K> :
      Value;
  };
}

function style<T extends object>(type: T, rules: style.Map): T {
  appearance.style(type, rules);
  return type;
}

function macro(rules: macro.Map): macro.Map {
  appearance.macro(rules);
  return rules;
}

export { macro, style };
