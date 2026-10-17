import type { Host } from '../render/host';
import { afterFlush } from '../render/scheduler';
import type { Claim } from '../style/claim';
import { applyDeclarations } from './declarations';
import { emit } from './sheet';

const SVG = 'http://www.w3.org/2000/svg';
const CONTROLS = ['checked', 'value'];
const ENUMERATED = ['contentEditable', 'contenteditable', 'draggable', 'spellcheck'];
const ALIASES: Record<string, string> = { autoFocus: 'autofocus', contentEditable: 'contenteditable', htmlFor: 'for' };
const events = new WeakMap<Element, Map<string, EventListener>>();
const controlled = new WeakMap<Element, { props: Record<string, any>; dead?: boolean }>();
const restoring = new WeakSet<Document>();
const focusing: Element[] = [];

const dom: Host<Node> = {
  raw: 'dangerouslySetInnerHTML',
  deferred: CONTROLS,

  element(tag, parent) {
    return tag == 'svg' || parent instanceof SVGElement && parent.localName != 'foreignObject'
      ? document.createElementNS(SVG, tag)
      : document.createElement(tag);
  },
  text: (value) => document.createTextNode(value),
  marker: (label) => document.createComment(label),
  fragment: () => document.createDocumentFragment(),

  insert: (parent, node, before) => parent.insertBefore(node, before),
  remove: (node) => (node as ChildNode).remove(),
  parent: (node) => node.parentNode,
  next: (node) => node.nextSibling,
  root: (node) => node.getRootNode(),
  clear: (container) => (container as Element).replaceChildren(),
  setText(node, value) {
    node.nodeValue = value;
  },
  target(into, parent) {
    if (typeof into != 'string') return into as Node;

    const root = parent.getRootNode();
    const found = [...document.querySelectorAll(into)];

    if (root instanceof DocumentFragment) found.push(...root.querySelectorAll(into));

    if (found.length != 1)
      throw new Error(`Portal target "${into}" ${found.length ? 'is ambiguous' : 'was not found'}.`);

    return found[0];
  },

  prop: (element, key, previous, next) => patchProp(element as Element, key, previous, next),
  style: (element, previous, next) => applyClaim(element as Element, previous, next),

  created(element, props) {
    if (props.autofocus || props.autoFocus) focusing.push(element as Element);
  },
  settle(node, next, previous) {
    const element = node as Element;

    for (const key of CONTROLS) {
      const value = next[key];
      const live = (element as any)[key];
      const differs = value == null || !(key in element)
        ? previous[key] !== value
        : key == 'value' ? String(live) !== String(value) : live !== value;

      if (differs) patchProp(element, key, previous[key], value);
    }

    const entry = controlled.get(element);

    if (entry) entry.props = next;
    else if (CONTROLS.some((key) => next[key] != null)) {
      const document = element.ownerDocument;

      controlled.set(element, { props: next });

      if (!restoring.has(document)) {
        restoring.add(document);
        document.addEventListener('input', restoreTarget);
        document.addEventListener('change', restoreTarget);
      }
    }
  },
  release(node) {
    const element = node as Element;
    const entry = controlled.get(element);

    if (entry) entry.dead = true;
    for (const [id, listener] of events.get(element) || []) {
      const [name, capture] = id.split(':');
      element.removeEventListener(name, listener, capture === 'true');
    }
  },
  flush() {
    for (const element of focusing.splice(0))
      if (element.isConnected) (element as HTMLElement).focus();
  }
};

function patchProp(element: Element, key: string, previous: any, next: any) {
  if (key == 'dangerouslySetInnerHTML') {
    element.innerHTML = next?.__html || '';
    return;
  }

  if (/^on[A-Z]/.test(key)) {
    const capture = key.endsWith('Capture');
    const lower = (capture ? key.slice(2, -7) : key.slice(2)).toLowerCase();
    const name = lower == 'doubleclick' ? 'dblclick' : lower;
    const id = `${name}:${capture}`;
    let listeners = events.get(element);
    if (!listeners) events.set(element, (listeners = new Map()));
    const current = listeners.get(id);

    if (current) element.removeEventListener(name, current, capture);
    if (typeof next == 'function') {
      listeners.set(id, next);
      element.addEventListener(name, next, capture);
    } else listeners.delete(id);
    return;
  }

  const name = ALIASES[key] || key;

  if ((key.startsWith('aria-') || key.startsWith('data-') || ENUMERATED.includes(key)) && next != null) {
    element.setAttribute(name, String(next));
    return;
  }

  if (next === null || next === undefined || next === false) {
    if (key in element && typeof (element as any)[key] != 'function')
      try {
        const current = (element as any)[key];
        (element as any)[key] = typeof current == 'boolean'
          ? false
          : typeof current == 'number'
            ? 0
            : '';
      } catch {}
    element.removeAttribute(element.namespaceURI === SVG ? name.toLowerCase() : name);
    element.removeAttribute(name);
    return;
  }

  if (key in element && (element.namespaceURI !== SVG || settable(element, key)))
    try {
      (element as any)[key] = next;
      return;
    } catch {}

  element.setAttribute(name, next === true ? '' : String(next));
}

function restoreTarget(event: Event) {
  const element = event.target as HTMLInputElement;
  const entry = controlled.get(element);

  if (entry && event.type == settles(entry.props, element))
    queueMicrotask(() => afterFlush(() => restore(element, entry)));
}

function settles(props: Record<string, any>, element: HTMLInputElement) {
  if (props.onInput) return 'input';
  if (props.onChange) return 'change';
  return element.type == 'checkbox' || element.type == 'radio' || element.localName == 'select' ? 'change' : 'input';
}

function restore(element: any, entry: { props: Record<string, any>; dead?: boolean }) {
  for (const key of CONTROLS) {
    const value = entry.props[key];

    if (value == null || entry.dead) continue;
    if (key == 'value' ? String(element.value) !== String(value) : element[key] !== value)
      element[key] = value;
  }
}

function settable(element: Element, key: string) {
  let target: object = element;
  let descriptor: PropertyDescriptor | undefined;

  while (!(descriptor = Object.getOwnPropertyDescriptor(target, key)))
    target = Object.getPrototypeOf(target);

  return !!(descriptor.set || descriptor.writable);
}

function className(element: Element, claim: Claim | undefined) {
  if (!claim) return '';

  const names = claim.classes.map((entry) =>
    typeof entry == 'string' ? entry : emit(entry.block, entry.depth, element.ownerDocument)
  );

  return [...new Set(names)].join(' ');
}

function applyClaim(element: Element, before: Claim | undefined, after: Claim) {
  const previous = className(element, before);
  const next = className(element, after);

  if (previous !== next) {
    if (next) element.setAttribute('class', next);
    else element.removeAttribute('class');
  }

  applyDeclarations((element as HTMLElement).style, after.declarations, before?.declarations);
}

export { dom };
