import * as appearance from './appearance';
import { registerEmitter } from './appearance-protocol';
import type { Block } from './appearance-protocol';
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
  | `_${string}`;

type Argument<K extends keyof macro.Registry> =
  macro.Registry[K] extends (value: infer A, ...rest: any[]) => any ? A : never;

export declare namespace macro {
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

export declare namespace style {
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

interface Sheet {
  element: HTMLStyleElement;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const sheets = new WeakMap<Document, Sheet>();

function style<T extends object>(type: T, rules: style.Map): T {
  appearance.style(type, rules);
  registerEmitter(emit);
  return type;
}

function macro(rules: macro.Map): macro.Map {
  appearance.macro(rules);
  registerEmitter(emit);
  return rules;
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

  let byDepth = sheet.emitted.get(block);
  if (!byDepth) sheet.emitted.set(block, (byDepth = new Map()));

  const cached = byDepth.get(depth);
  if (cached) return cached;

  const css = serialize(document, block.declarations);
  const base = (depth ? `${block.name}-d${depth}` : block.name).replace(/[^\w-]/g, '_');
  let name = base;

  for (let index = 2; sheet.names.has(name) && sheet.names.get(name) !== css; index++)
    name = `${base}-${index}`;

  if (!sheet.names.has(name)) {
    const { positions } = sheet;
    let at = positions.findIndex(([d, o]) => d > depth || d == depth && o > block.ordinal);
    if (at < 0) at = positions.length;

    sheet.names.set(name, css);
    positions.splice(at, 0, [depth, block.ordinal]);
    sheet.element.sheet!.insertRule(`.${name}{${css}}`, at);
  }

  byDepth.set(depth, name);
  return name;
}

function serialize(document: Document, declarations: Declaration) {
  const value = document.createElement('div').style as any;
  applyDeclarations(value, declarations);
  return value.cssText;
}

export { macro, style };
