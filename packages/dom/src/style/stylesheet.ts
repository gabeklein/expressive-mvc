import * as appearance from './appearance';
import { registerEmitter } from './protocol';
import type { Block } from './protocol';
import { applyDeclarations } from './declarations';
import type { Declaration } from './declarations';
import type { Numeric, Single, Unitless } from './numeric';

type Member = Extract<keyof CSSStyleDeclaration, string>;

type Settable = {
  [K in Member]-?: CSSStyleDeclaration[K] extends Function ? never : K;
}[Member];

type Macro<T> = Extract<
  Exclude<{ [K in keyof T]-?: T[K] extends (...args: any[]) => unknown ? K : never }[keyof T], 'default'>,
  string
>;

type Named<T> = Extract<
  { [K in keyof T]-?: K extends `$${string}` ? T[K] extends string ? K : never : never }[keyof T],
  string
>;

type Argument<F> = F extends (...args: infer P) => any
  ? P extends [] ? true : P[0] | (undefined extends P[0] ? true : never)
  : never;

type Key<T> =
  | style.Property
  | Macro<T>
  | `--${string}`
  | `_${string}`
  | Named<T>
  | style.Condition;

type Layers<T> = readonly (style.Map<T> | Layers<T> | false | null | undefined)[] & { [K in style.Property | Macro<T>]?: unknown };

type Body<T> = style.Map<T> | Layers<T>;

type Literal = string | boolean | null | undefined | readonly Literal[];

type Zero = Literal | 0 | readonly Zero[];

type Numbers<T> = T extends { default(...args: any[]): unknown } ? Numeric : Unitless;

declare namespace style {
  /** CSS property names, minus the CSSOM's own members. */
  type Property = Exclude<Settable, 'length' | 'parentRule' | 'cssText'>;

  /**
   * A state (`:hover`) or environment (`@media …`) key. Its body applies while
   * the condition holds; the host decides how to honour it.
   */
  type Condition = `:${string}` | `@${string}`;

  /** What a declaration or macro argument may be; never a plain object. */
  type Value =
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly Value[];

  /**
   * Body of a `style()` map. Bare keys are declarations or calls to a macro
   * of `T`, `_name` opens a rule or descendant scope, `:state` and `@media …`
   * apply their body conditionally, as does `$name` for a condition named on
   * `T`. A rule or condition body may be an array of maps, merged in order.
   */
  type Map<T = {}> = {
    [K in Key<T>]?:
      K extends `_${string}` | Condition | Named<T> ? Body<T> :
      K extends Macro<T> ? Argument<T[K]> :
      K extends Single ? number | Literal :
      K extends Numbers<T> | `--${string}` ? Value :
      K extends Numeric ? Zero :
      Literal;
  };

  /** A `style()` whose maps may call the macros of `T`. */
  interface Apply<T> {
    <C extends object>(type: C, ...maps: (Map<T> | false | null | undefined)[]): C;
  }
}

/**
 * Base class for a macro pack. Each method is a macro, layered over the class
 * it extends; `default` handles any key no macro owns. A `$name` field holds
 * a condition (`'@media …'` or `':state'`) maps may use as a key.
 */
class Style {
  /**
   * The `style()` for this pack. Without maps, one per class. Each call with
   * maps is its own scope - their rules style only elements written by
   * components it styles, below their own declarations.
   */
  static use<T extends Style>(
    this: new () => T,
    ...rules: (style.Map<T> | false | null | undefined)[]
  ): style.Apply<T> {
    const given = rules.filter(Boolean) as appearance.StyleMap[];
    const shared = !given.length;
    let apply = shared ? bound.get(this) : undefined;

    if (!apply) {
      let pack: appearance.Pack | undefined;

      apply = (type, ...maps) => {
        pack ||= {
          label: this.name,
          layers: layers(this),
          rules: given
        };

        return register(type, maps, pack);
      };

      if (shared) bound.set(this, apply);
    }

    return apply;
  }
}

interface Sheet {
  element: HTMLStyleElement;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const sheets = new WeakMap<Document, Sheet>();
const bound = new WeakMap<Function, style.Apply<any>>();
let groups = 0;

function style<T extends object>(type: T, ...maps: (style.Map | false | null | undefined)[]): T {
  return register(type, maps);
}

function register<T extends object>(type: T, maps: readonly unknown[], pack?: appearance.Pack): T {
  const present = maps.filter(Boolean) as appearance.StyleMap[];

  for (const rules of present.length || !pack ? present : [{}]) appearance.style(type, rules, pack);
  registerEmitter(emit);
  return type;
}

function layers(type: Function) {
  const instance = new (type as new () => object)();
  const maps: appearance.StyleMap[] = [];
  const conditions: appearance.StyleMap = {};

  for (const [key, value] of Object.entries(instance)) {
    if (key[0] != '$')
      throw new Error(`Field "${key}" on ${type.name} is reserved. Define macros as methods.`);

    if (typeof value != 'string' || value[0] != '@' && value[0] != ':')
      throw new Error(`Condition "${key}" on ${type.name} must start with "@" or ":".`);

    conditions[key] = value;
  }

  for (let proto = type.prototype; proto !== Style.prototype; proto = Object.getPrototypeOf(proto)) {
    const map = proto === type.prototype ? conditions : {};

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key == 'constructor') continue;

      const { value } = Object.getOwnPropertyDescriptor(proto, key)!;

      if (typeof value != 'function' || key[0] == '_' || key[0] == '$')
        throw new Error(`"${key}" on ${type.name} must be a method with a bare name.`);

      map[key] = value.bind(instance);
    }

    maps.unshift(map);
  }

  return maps;
}

function emit(block: Block, depth: number, document: Document) {
  let sheet = sheets.get(document);

  if (!sheet?.element.sheet) {
    const element = document.createElement('style');
    element.dataset.expressive = 'dom';
    document.head.append(element);
    sheet = { element, emitted: new WeakMap(), names: new Map(), positions: [] };
    sheets.set(document, sheet);
  }

  if (block.group) depth = 0;

  let byDepth = sheet.emitted.get(block);
  if (!byDepth) sheet.emitted.set(block, (byDepth = new Map()));

  const cached = byDepth.get(depth);
  if (cached) return cached;

  const when = block.when || [];
  const at = when.filter((condition) => typeof condition == 'string' && condition[0] == '@') as string[];
  const pseudo = when.filter((condition) => typeof condition == 'string' && condition[0] == ':').join('');
  const split = pseudo.indexOf('::');
  const states = split < 0 ? pseudo : pseudo.slice(0, split);
  const element = split < 0 ? '' : pseudo.slice(split);
  const scope = when.map((condition) =>
    typeof condition == 'string' ? '' : `:where(.${emit(condition.on, 0, document)}${condition.state}) `
  ).join('');
  const selector = `${scope}.%${states ? `:where(${states})` : ''}${element}`;
  const css = block.group ? `\0${groups++}` : serialize(document, block.declarations);
  const key = [...at, selector, css].join('\0');
  const label = [
    depth ? `${block.name}-d${depth}` : block.name,
    ...when.map((condition) => typeof condition == 'string' ? condition : condition.on.name + condition.state),
    ...block.group ? ['group'] : []
  ].join('-');
  const base = label.replace(/[^\w-]+/g, '_').replace(/_*(-)_*|_+$/g, '$1');
  let name = base;

  for (let index = 2; sheet.names.has(name) && sheet.names.get(name) !== key; index++)
    name = `${base}-${index}`;

  if (!sheet.names.has(name)) {
    sheet.names.set(name, key);

    if (!block.group) {
      const { positions } = sheet;
      let index = positions.findIndex(([d, o]) => d > depth || d == depth && o > block.ordinal);
      if (index < 0) index = positions.length;

      positions.splice(index, 0, [depth, block.ordinal]);
      sheet.element.sheet!.insertRule(
        at.reduceRight((rule, condition) => `${condition}{${rule}}`, `${selector.replace('%', name)}{${css}}`),
        index
      );
    }
  }

  byDepth.set(depth, name);
  return name;
}

function serialize(document: Document, declarations: Declaration) {
  const value = document.createElement('div').style as any;
  applyDeclarations(value, declarations);
  return value.cssText;
}

export { Style, style };
