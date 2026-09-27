import * as appearance from './appearance';
import { registerEmitter } from './appearance-protocol';
import type { Block } from './appearance-protocol';
import type { StyleMap } from './appearance';
import { applyDeclarations } from './declarations';
import type { Declaration } from './declarations';

interface Sheet {
  element: HTMLStyleElement;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const sheets = new WeakMap<Document, Sheet>();

function style<T extends object>(type: T, rules: StyleMap): T {
  appearance.style(type, rules);
  registerEmitter(emit);
  return type;
}

function macro(rules: StyleMap): StyleMap {
  appearance.macro(rules);
  registerEmitter(emit);
  return rules;
}

function emit(block: Block, depth: number, document: Document) {
  let sheet = sheets.get(document);

  if (!sheet?.element.sheet) {
    const element = document.createElement('style');
    element.dataset.expressive = 'jsx';
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
