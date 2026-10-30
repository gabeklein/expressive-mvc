import { applyDeclarations } from './declarations';
import { appearanceToken, createAppearanceToken, emitClass, reserved } from './protocol';
import type { AppearanceContext, ResolvedAppearance } from './protocol';

type Style = string | Record<string, unknown> | false | null | undefined | readonly Style[];

interface Appearance {
  context?: AppearanceContext;
  entries: Forwarded[];
}

interface Forwarded {
  hops: number;
  style: Style;
}

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

interface Ticket {
  classes: string[];
  tokens: Carried[];
}

const tickets = new WeakMap<object, Ticket>();

function componentProps(
  type: unknown,
  props: Record<string, any>,
  appearance: Appearance | undefined
) {
  const context = appearance?.context;

  for (const key of Object.keys(props)) reserved(key);

  if (!context || typeof type != 'function') return { appearance, props };

  const value = context.resolve(props);
  const entries = appearance!.entries;

  if (!value) return { appearance: { entries }, props };

  return {
    appearance: {
      context: value.context,
      entries
    },
    props: { ...props, style: [createAppearanceToken(value), props.style] }
  };
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

function applyClaim(element: Element, before: Claim | undefined, after: Claim) {
  const previous = before || { className: '', declarations: {} };

  if (previous.className !== after.className) {
    if (after.className) element.setAttribute('class', after.className);
    else element.removeAttribute('class');
  }

  applyDeclarations((element as HTMLElement).style, after.declarations, previous.declarations);
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

export { applyClaim, claim, componentProps, door };
export type { Appearance, Claim, Style };
