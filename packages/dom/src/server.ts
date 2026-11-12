import './jsx-runtime';

import { Component, Context, Model, unbind } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { Fragment } from '@expressive/mvc/jsx-runtime';

import { resolve } from './node/loader';
import { isVNode, PORTAL } from './node/vnode';
import type { Node, VNode } from './node/vnode';
import { call, dispose, enter } from './render/adapter';
import type { Scope } from './render/adapter';
import { isCollection } from './render/collection';
import { renderable, unplaced } from './render/component';
import type { Fiber, Placement } from './render/fiber';
import { latest } from './render/hot';
import { notRenderable } from './render/mount';
import { source } from './render/reconcile';
import { authored, consume, observe, renderedAppearance } from './render/style';
import { isThenable } from './render/suspense';
import { claim, componentProps, placed } from './style/claim';
import type { Appearance } from './style/claim';
import type { Declaration } from './style/declarations';
import { serialize } from './style/declarations';
import { unmatched } from './style/diagnose';
import { reserved, serving } from './style/protocol';
import type { Sink } from './style/protocol';

const UNITLESS = new Set(
  ('animationIterationCount aspectRatio baselineShift borderImageOutset borderImageSlice borderImageWidth columnCount ' +
  'columns cx cy fillOpacity flex flexGrow flexShrink floodOpacity fontSizeAdjust fontWeight gridArea gridColumn ' +
  'gridColumnEnd gridColumnStart gridRow gridRowEnd gridRowStart hyphenateLimitChars initialLetter lineHeight mathDepth ' +
  'opacity order orphans r rx ry scale shapeImageThreshold stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit ' +
  'strokeOpacity strokeWidth tabSize webkitBoxFlex webkitBoxOrdinalGroup webkitLineClamp widows x y zIndex zoom').split(' ')
);

const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style']);
const ALIASES: Record<string, string> = {
  acceptCharset: 'accept-charset',
  autoFocus: 'autofocus',
  contentEditable: 'contenteditable',
  defaultChecked: 'checked',
  defaultValue: 'value',
  htmlFor: 'for',
  httpEquiv: 'http-equiv'
};
const STRINGIFIED = /^(aria-|data-)|^(contentEditable|contenteditable|draggable|spellcheck)$/;
const SKIPPED = new Set(['children', 'className', 'dangerouslySetInnerHTML', 'innerHTML', 'innerText', 'key', 'ref', 'style', 'textContent']);

interface Output {
  /** Markup for the container the node mounts in, as `render()` would leave it. */
  html: string;
  /** Rules the render emitted, for a `<style>` in the document head. */
  css: string;
}

interface Pass {
  contexts: Context[];
  sink: Sink;
}

function kebab(key: string) {
  if (key.startsWith('--')) return key;
  if (key == 'cssFloat') return 'float';
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`).replace(/^webkit-/, '-webkit-');
}

function text(declarations: Declaration) {
  const output: string[] = [];

  for (const key of Object.keys(declarations)) {
    const value = declarations[key];

    if (value == null || value === '') continue;

    const css = typeof value == 'number' && value !== 0 && !key.startsWith('--') && !UNITLESS.has(key) ? `${value}px` : String(value);
    output.push(`${kebab(key)}: ${css};`);
  }

  return output.join(' ');
}

function escape(value: string, attribute?: boolean) {
  const output = value.replace(/&/g, '&amp;').replace(/ /g, '&nbsp;');

  return attribute
    ? output.replace(/"/g, '&quot;')
    : output.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a node to markup and the style rules it emits, waiting on anything it suspends for.
 *
 * `new()` runs; effects and `ready` never do. Every instance is destroyed once rendered.
 * A suspended render is awaited and retried in place; no fallback is drawn.
 * A `catch` boundary handles an error once, then renders again; a second error propagates.
 * Portals render nothing.
 */
async function renderToString(node: Node): Promise<Output> {
  const rules: string[] = [];
  const roots = new Map<object, string>();
  const sink: Sink = {
    insert: (rule, index) => rules.splice(index, 0, rule),
    root: (key, css) => roots.set(key, css),
    serialize: text,
    unitless: (property) => UNITLESS.has(property)
  };
  const context = new Context(Context.root);
  const pass: Pass = { contexts: [context], sink };

  try {
    const html = await range('fragment', walk(node, pass, context));
    const css = [...rules, ...roots.values()].filter(Boolean).join('\n');

    return { html, css };
  } finally {
    for (const context of pass.contexts.reverse()) context.pop();
  }
}

async function range(kind: string, inner: Promise<string>) {
  return `<!--${kind}-->${await inner}<!--/${kind}-->`;
}

async function walk(value: Node, pass: Pass, context: Context, appearance?: Appearance, svg?: boolean): Promise<string> {
  if (Array.isArray(value)) {
    let output = '';

    for (const each of value) output += await walk(each, pass, context, appearance, svg);

    return output;
  }

  if (value === null || value === undefined || typeof value == 'boolean') return '';

  value = source(value);
  appearance = authored(value, appearance);

  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'bigint') return escape(String(value));
  if (renderable(value)) return range('component', component(value, pass, context, placed(appearance), svg));
  if (value instanceof Model) notRenderable(value.constructor);
  if (isCollection(value)) return range('collection', collection(value, pass, context, appearance, svg));
  if (!isVNode(value)) throw new TypeError(`Cannot render ${String(value)}.`);
  if (value.type === Fragment) return range('fragment', walk(value.props.children, pass, context, appearance, svg));
  if (value.type === PORTAL) return '<!--portal-->';
  if (typeof value.type == 'string') return element(value, pass, context, appearance, svg);
  if (typeof value.type != 'function') throw new Error(`Cannot render ${String(value.type)}.`);

  if (value.type === Component || value.type.prototype instanceof Component)
    return range('component', owned(value, pass, context, appearance, svg));

  if (value.type.prototype instanceof Model) notRenderable(value.type);

  return range('function', fn(value, pass, context, appearance, svg));
}

async function attempt<T>(pass: Pass, run: () => T): Promise<T> {
  while (true)
    try {
      return serving(pass.sink, run);
    } catch (thrown) {
      if (!isThenable(thrown)) throw thrown;
      await thrown;
    }
}

function scoped(context: Context, fiber: Fiber, render: () => Node) {
  const scope = { active: true, context, subscriptions: [] } as unknown as Scope;

  try {
    return consume(fiber, () => enter(scope, render));
  } finally {
    dispose(scope);
  }
}

async function fn(value: VNode, pass: Pass, context: Context, appearance?: Appearance, svg?: boolean) {
  const resolved = serving(pass.sink, () => componentProps(value.type, value.props, appearance));
  const type = latest(value.type as Function);
  const fiber = {
    kind: 'function',
    type: value.type,
    props: observe(resolved.props),
    appearance: resolved.appearance
  } as Fiber;

  const output = await attempt(pass, () => scoped(context, fiber, () => resolve(type, fiber.props!, () => call(type, fiber.props))));

  return walk(output, pass, context, serving(pass.sink, () => renderedAppearance(fiber)), svg);
}

async function owned(value: VNode, pass: Pass, context: Context, appearance?: Appearance, svg?: boolean) {
  const resolved = serving(pass.sink, () => componentProps(value.type, value.props, appearance));
  const Type = value.type as new (props: unknown) => Component;
  const props = observe(resolved.props);
  const instance = new Type(props);

  unplaced(instance);

  return component(instance, pass, context, resolved.appearance, svg, props);
}

async function component(instance: Component, pass: Pass, context: Context, appearance?: Appearance, svg?: boolean, props?: Record<string, any>): Promise<string> {
  const child = context.push(instance, props ? () => instance.set(null) : undefined);
  const placement = (props || {}) as Placement;
  const handler = placement.catch || instance.catch;
  const fiber = {
    kind: 'component',
    type: instance.constructor,
    props: props || instance.props,
    instance,
    appearance
  } as Fiber;
  let caught = false;

  pass.contexts.push(child);

  while (true) {
    let proxy = instance;
    const release = watch(instance, (current) => { proxy = current; });

    try {
      const output = await attempt(pass, () => scoped(child, fiber, () => unbind(proxy.render).call(proxy, fiber.props)));
      return await walk(output, pass, child, serving(pass.sink, () => renderedAppearance(fiber)), svg);
    } catch (thrown) {
      if (!handler || caught) throw thrown;

      caught = true;
      await handler.call(instance, thrown instanceof Error ? thrown : new Error(String(thrown)), instance);
    } finally {
      release();
    }
  }
}

async function collection(value: Parameters<typeof watch>[0], pass: Pass, context: Context, appearance?: Appearance, svg?: boolean) {
  let proxy = value;
  const release = watch(value, (current) => { proxy = current; });

  try {
    const output = await attempt(pass, () => (proxy as unknown as { render(): Node }).render());
    return walk(output, pass, context, appearance, svg);
  } finally {
    release();
  }
}

async function element(value: VNode, pass: Pass, context: Context, appearance?: Appearance, svg?: boolean) {
  const tag = value.type as string;
  const props = value.props as Record<string, any>;
  const inSvg = tag == 'svg' || !!svg;
  const { sink } = pass;
  let attributes = '';

  const claimed = serving(sink, () => {
    const resolved = appearance?.context?.resolve(props, tag);

    unmatched(props, [appearance?.context], appearance?.author, undefined, tag);

    return claim(sink, appearance, resolved, props.className, props.style);
  });

  for (const key of Object.keys(props)) {
    const next = props[key];

    if (key[0] == '_') {
      reserved(key);
      continue;
    }

    if (SKIPPED.has(key) || /^on[A-Z]/.test(key) || typeof next == 'function') continue;
    if (key == 'value' || key == 'checked' || key == 'selected') continue;
    if (next === null || next === undefined || next === false && !STRINGIFIED.test(key)) continue;

    const name = ALIASES[key] || (inSvg ? key : key.toLowerCase());

    attributes += next === true && !STRINGIFIED.test(key) ? ` ${name}=""` : ` ${name}="${escape(String(next), true)}"`;
  }

  if (claimed.className) attributes += ` class="${escape(claimed.className, true)}"`;

  const style = serialize(sink, claimed.declarations);

  if (style) attributes += ` style="${escape(style, true)}"`;

  for (const key of ['value', 'checked', 'selected']) {
    const next = props[key];

    if (next === null || next === undefined || next === false || tag == 'textarea' && key == 'value') continue;

    attributes += next === true ? ` ${key}=""` : ` ${key}="${escape(String(next), true)}"`;
  }

  const open = `<${tag}${attributes}>`;

  if (VOID.has(tag) && !inSvg) return open;

  let inner: string;

  if (props.dangerouslySetInnerHTML) inner = props.dangerouslySetInnerHTML.__html || '';
  else if (tag == 'textarea' && props.value != null) inner = escape(String(props.value));
  else if (RAW.has(tag)) inner = childrenText(props.children);
  else
    inner = await walk(
      props.children,
      pass,
      context,
      claimed.context || appearance?.author
        ? { author: appearance?.author, context: claimed.context, entries: [] }
        : undefined,
      inSvg && tag != 'foreignObject'
    );

  return `${open}${inner}</${tag}>`;
}

function childrenText(value: unknown): string {
  if (Array.isArray(value)) return value.map(childrenText).join('');
  if (value === null || value === undefined || typeof value == 'boolean') return '';
  return String(value);
}

export { renderToString };
export type { Output };
