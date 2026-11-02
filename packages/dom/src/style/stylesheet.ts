import * as appearance from './appearance';
import { registerEmitter } from './protocol';
import type { Block } from './protocol';
import { applyDeclarations } from './declarations';
import type { Declaration } from './declarations';

type Member = Extract<keyof CSSStyleDeclaration, string>;

type Settable = {
  [K in Member]-?: CSSStyleDeclaration[K] extends Function ? never : K;
}[Member];

type Key =
  | style.Property
  | keyof macro.Registry
  | `--${string}`
  | `_${string}`
  | style.Condition;

type Argument<K extends keyof macro.Registry> =
  macro.Registry[K] extends (value: infer A, ...rest: any[]) => any ? A : never;

declare namespace macro {
  /**
   * Macros visible to a style map. A pack augments this interface to declare
   * what it registers with `macro()`.
   */
  interface Registry {}

  /**
   * Registry entries for the macros in a pack, so one line declares them all:
   * `interface Registry extends macro.From<typeof pack> {}`.
   */
  type From<T> = {
    [K in keyof T as K extends `_${string}` | `$${string}` | '*' ? never : K]: T[K];
  };

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
   * Body of a `style()` map. Bare keys are declarations or macro calls,
   * `_name` opens a rule or descendant scope, `:state` and `@media …` apply
   * their body conditionally, and `$name` is reserved.
   */
  type Map = {
    [K in Key]?:
      K extends `_${string}` | Condition ? Map :
      K extends keyof macro.Registry ? Argument<K> | (undefined extends Argument<K> ? true : never) :
      Value;
  };
}

interface Sheet {
  element: HTMLStyleElement;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const sheets = new WeakMap<Document, Sheet>();
let groups = 0;

function style<T extends object>(type: T, ...maps: (style.Map | false | null | undefined)[]): T {
  for (const rules of maps) if (rules) appearance.style(type, rules);
  registerEmitter(emit);
  return type;
}

function macro(rules: macro.Map): macro.Map {
  appearance.macro(rules);
  registerEmitter(emit);
  return rules;
}

function root(packs: readonly macro.Map[]) {
  registerEmitter(emit);
  return appearance.root(packs);
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

export { macro, root, style };
