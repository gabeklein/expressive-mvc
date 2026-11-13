import * as appearance from './appearance';
import { isSink, registerEmitter } from './protocol';
import type { Block, Target } from './protocol';
import { serialize } from './declarations';
import type { Declaration } from './declarations';
import { attachRoots, setRoot } from './root';
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
  { [K in keyof T]-?: K extends `$${string}` ? T[K] extends style.Condition ? K : string extends T[K] ? K : never : never }[keyof T],
  string
>;

type Variable<T> = Extract<
  { [K in keyof T]-?: K extends `$${string}` ? T[K] extends string ? T[K] extends style.Condition ? never : K : never : never }[keyof T],
  string
>;

type Bare<K> = K extends `$${infer N}` ? N : never;

type Tokens<T> = { readonly [K in Variable<T> as Bare<K>]: string };

type Rules<T> = style.Map<T> | ((tokens: Tokens<T>) => style.Map<T>) | false | null | undefined;

type Argument<F> = F extends (...args: infer P) => any
  ? P extends [] ? true : P[0] | (undefined extends P[0] ? true : never)
  : never;

type Key<T> =
  | style.Property
  | Macro<T>
  | `--${string}`
  | `_${string}`
  | Named<T>
  | Variable<T>
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
   * Body of a `style()` map - declarations, macro calls, rules and conditions.
   *
   * Bare keys are declarations or calls to a macro of `T`. `_name` opens a rule or descendant scope.
   * `:state`, `@media …` and a `$name` condition of `T` apply their body conditionally; a `$name` variable of `T` takes a value.
   * A rule or condition body may be an array of maps, merged in order.
   */
  type Map<T = {}> = {
    [K in Key<T>]?:
      K extends Named<T> & Variable<T> ? Body<T> | Value :
      K extends `_${string}` | Condition | Named<T> ? Body<T> :
      K extends Macro<T> ? Argument<T[K]> :
      K extends Single ? number | Literal :
      K extends Numbers<T> | Variable<T> | `--${string}` ? Value :
      K extends Numeric ? Zero :
      Literal;
  };

  /** A `style()` whose maps may call the macros of `T`. */
  interface Apply<T> {
    /**
     * Style a component with maps that may call the macros of `T`.
     *
     * A map may be a function of the pack's tokens - `var()` references to
     * its variables, keyed without the `$` - called once here.
     */
    <C extends object>(type: C, ...maps: Rules<T>[]): C;
  }
}

/**
 * Base class for a new host's macro pack - apps extend `Css`.
 *
 * Each method is a macro, layered over the class it extends; `default` handles any key no macro owns.
 * A `$name` field holds a condition (`'@media …'` or `':state'`), or else a variable - its default, or a `--name` to use as is.
 * Any other field throws.
 */
class Style {
  /**
   * The `style()` for this pack, with optional pack rules.
   *
   * Without rules, one per class. Each call with rules is its own scope - they style only elements written by components it styles.
   * A map may be a function of the pack's `$` tokens, called once here.
   */
  static use<T extends Style>(
    this: new () => T,
    ...rules: Rules<T>[]
  ): style.Apply<T> {
    const { tokens } = fields(this);
    const given = resolve(rules, tokens);
    const shared = !given.length;
    let apply = shared ? bound.get(this) : undefined;

    if (!apply) {
      let pack: appearance.Pack | undefined;

      apply = (<C extends object>(type: C, ...maps: unknown[]) => {
        pack ||= {
          label: this.name,
          layers: layers(this),
          rules: given
        };

        return register(type, resolve(maps, tokens), pack);
      }) as style.Apply<T>;

      if (shared) bound.set(this, apply);
    }

    return apply;
  }
}

interface Fields {
  aliases: Record<string, string>;
  instance: object;
  tokens: Record<string, string>;
}

interface Sheet {
  insert(rule: string, index: number): void;
  live(): boolean;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const sheets = new WeakMap<Target, Sheet>();
const bound = new WeakMap<Function, style.Apply<any>>();
const packs = new WeakMap<Function, Fields>();
let groups = 0;

/**
 * Register style maps on a component, returned as is - macros need a pack's `use()`.
 *
 * Calls layer in order; falsy maps are skipped.
 * Throws once the component has rendered.
 */
function style<T extends object>(type: T, ...maps: (style.Map | false | null | undefined)[]): T {
  return register(type, maps);
}

function resolve(maps: readonly unknown[], tokens: object) {
  return maps
    .map((map) => (typeof map == 'function' ? map(tokens) : map))
    .filter(Boolean) as appearance.StyleMap[];
}

function register<T extends object>(type: T, maps: readonly unknown[], pack?: appearance.Pack): T {
  const present = maps.filter(Boolean) as appearance.StyleMap[];

  for (const rules of present.length || !pack ? present : [{}]) appearance.style(type, rules, pack);
  registerEmitter(emit);
  return type;
}

function fields(type: Function) {
  let known = packs.get(type);
  if (known) return known;

  const instance = new (type as new () => object)();
  const aliases: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const defaults: Declaration = {};

  for (const [key, value] of Object.entries(instance)) {
    if (key[0] != '$')
      throw new Error(`Field "${key}" on ${type.name} is reserved. Define macros as methods.`);

    if (typeof value != 'string')
      throw new Error(`"${key}" on ${type.name} must be a string.`);

    if (value[0] == '@' || value[0] == ':') {
      aliases[key] = value;
      continue;
    }

    const name = value.startsWith('--') ? value : `--${key.slice(1).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;

    if (name != value) defaults[name] = value;

    aliases[key] = name;
    tokens[key.slice(1)] = `var(${name})`;
  }

  if (Object.keys(defaults).length) setRoot(aliases, [{ declarations: defaults, when: [] }]);

  packs.set(type, (known = { aliases, instance, tokens }));
  return known;
}

function layers(type: Function) {
  const { aliases, instance } = fields(type);
  const maps: appearance.StyleMap[] = [];
  const conditions: appearance.StyleMap = { ...aliases };

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

function open(target: Target): Sheet {
  const state = { emitted: new WeakMap(), names: new Map(), positions: [] };

  if (isSink(target))
    return { ...state, live: () => true, insert: (rule, index) => target.insert(rule, index) };

  const element = target.createElement('style');
  element.dataset.expressive = 'dom';
  target.head.append(element);

  return { ...state, live: () => !!element.sheet, insert: (rule, index) => element.sheet!.insertRule(rule, index) };
}

function emit(block: Block, depth: number, target: Target) {
  let sheet = sheets.get(target);

  if (!sheet?.live()) {
    sheets.set(target, sheet = open(target));
    attachRoots(target);
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
    typeof condition == 'string' ? '' : `:where(.${emit(condition.on, 0, target)}${condition.state}) `
  ).join('');
  const selector = `${scope}.%${states ? `:where(${states})` : ''}${element}`;
  const css = block.group ? `\0${groups++}` : serialize(target, block.declarations);
  const key = [...at, selector, css].join('\0');
  const label = [
    depth ? `${block.name}-d${depth}` : block.name,
    ...when.map((condition) => typeof condition == 'string' ? condition : condition.on.name + condition.state),
    ...block.group ? ['group'] : []
  ].join('-');
  const base = label.replace(/[^\w-]+/g, '_').replace(/_*(-)_*|_+$/g, '$1') || 'c';
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
      sheet.insert(
        at.reduceRight((rule, condition) => `${condition}{${rule}}`, `${selector.replace('%', name)}{${css}}`),
        index
      );
    }
  }

  byDepth.set(depth, name);
  return name;
}

export { Style, style };
