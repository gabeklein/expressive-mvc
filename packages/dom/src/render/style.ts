import type { Node as RenderNode } from '../node/vnode';
import { applyDeclarations } from '../style/declarations';
import { appearanceRoot, appearanceToken, createAppearanceToken, emitClass, enterAppearance } from '../style/protocol';
import type { AppearanceContext, ResolvedAppearance } from '../style/protocol';
import type { Fiber, Appearance, Style } from './fiber';
import { latest } from './hot';

interface Carried {
  appearance: ResolvedAppearance;
  doors: number;
}

interface Collected {
  classes: string[];
  declarations: Record<string, unknown>;
  tokens: Carried[];
}

interface Claim {
  className: string;
  context?: AppearanceContext;
  declarations: Record<string, unknown>;
}

let rendering: object | undefined;
let touched = false;
const observed = new WeakMap<object, Record<string, any>>();
const tickets = new WeakMap<object, Ticket>();

interface Ticket {
  classes: string[];
  tokens: Carried[];
}

function observe(props: Record<string, any>) {
  if (!('style' in props)) return props;

  let output = observed.get(props);

  if (!output) {
    const { style } = props;
    let handle: Style;
    let resolved = false;

    output = Object.defineProperty({ ...props }, 'style', {
      enumerable: true,
      get() {
        if (rendering === output) touched = true;
        if (!resolved) {
          handle = door(style);
          resolved = true;
        }
        return handle;
      }
    });
    observed.set(props, output);
  }

  return output;
}

function door(value: Style) {
  const collected: Collected = { classes: [], declarations: {}, tokens: [] };
  const { classes, declarations, tokens } = collected;

  collect(value, collected, 1);

  if (!classes.length && !tokens.length && !Object.keys(declarations).length) return undefined;

  const key = Object.freeze({});

  tickets.set(key, { classes, tokens });
  return Object.freeze({ ...declarations, [Symbol('style')]: key });
}

function consume(fiber: Fiber, render: () => RenderNode) {
  const previous = rendering;
  const read = touched;

  rendering = fiber.props;
  touched = false;

  try {
    const output = render();
    fiber.consumed = touched;
    return output;
  } finally {
    rendering = previous;
    touched = read;
  }
}

function applyClaim(element: Element, before: Claim | undefined, after: Claim) {
  const previous = before || { className: '', declarations: {} };

  if (previous.className !== after.className) {
    if (after.className) element.setAttribute('class', after.className);
    else element.removeAttribute('class');
  }

  applyDeclarations((element as HTMLElement).style, after.declarations, previous.declarations);
}

function claim(
  element: Element,
  appearance: Appearance | undefined,
  resolved: ResolvedAppearance | undefined,
  className: unknown,
  value: Style
): Claim {
  const collected: Collected = { classes: [], declarations: {}, tokens: [] };
  const entries = appearance?.entries || [];
  let context = appearance?.context;
  let reach = -1;

  if (resolved) collect(createAppearanceToken(resolved), collected, 0);
  appendClasses(collected.classes, className);
  collect(value, collected, 0);

  for (let index = entries.length - 1; index >= 0; index--)
    collect(entries[index].style, collected, entries[index].hops);

  for (const { appearance, doors } of collected.tokens) {
    for (const block of appearance.blocks || [])
      collected.classes.push(emitClass(block, doors, element.ownerDocument));
    if (appearance.classes) collected.classes.push(...appearance.classes);
    if (appearance.context && doors >= reach) {
      context = appearance.context;
      reach = doors;
    }
  }

  return {
    className: [...new Set(collected.classes)].join(' '),
    context,
    declarations: collected.declarations
  };
}

function renderedAppearance(fiber: Fiber): Appearance | undefined {
  if (fiber.kind != 'component' && fiber.kind != 'function') return fiber.appearance;

  const style = fiber.props?.style as Style;
  const entries = (fiber.appearance?.entries || []).map(({ hops, style }) => ({ hops: hops + 1, style }));
  const inherited = fiber.appearance?.context || appearanceRoot();
  const context = enterAppearance(inherited, latest(fiber.type as Function));

  if (context?.base && context !== inherited)
    entries.push({ hops: 0, style: context.base as Style });

  if (style && !fiber.consumed && !(fiber.instance && 'style' in fiber.instance)) entries.push({ hops: 0, style });

  return entries.length || context ? { context, entries } : undefined;
}

function collect(value: Style, collected: Collected, doors: number) {
  if (!value) return;

  const token = appearanceToken(value);
  if (token) {
    collected.tokens.push({ appearance: token, doors });
    Object.assign(collected.declarations, token.declarations);
    return;
  }

  if (typeof value == 'string') {
    appendClasses(collected.classes, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collect(entry, collected, doors));
    return;
  }

  for (const symbol of Object.getOwnPropertySymbols(value)) {
    const ticket = tickets.get((value as Record<symbol, object>)[symbol]);
    if (!ticket) continue;

    collected.classes.push(...ticket.classes);
    for (const carried of ticket.tokens)
      collected.tokens.push({ appearance: carried.appearance, doors: carried.doors + doors });
  }

  for (const key of Object.keys(value)) collected.declarations[key] = (value as Record<string, unknown>)[key];
}

function appendClasses(classes: string[], value: unknown) {
  if (typeof value == 'string') classes.push(...value.split(/\s+/).filter(Boolean));
}

export { applyClaim, claim, consume, observe, renderedAppearance };
export type { Claim };
