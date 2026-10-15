import { inserted } from './commits';
import { applyClaim, claim } from '../style/claim';
import type { Appearance } from '../style/claim';
import type { Fiber } from './fiber';
import { unmountFiber } from './mount';
import { reconcileChildren } from './reconcile';
import { afterFlush } from './scheduler';

const SVG = 'http://www.w3.org/2000/svg';
const CONTROLS = ['checked', 'value'];
const ENUMERATED = ['contentEditable', 'contenteditable', 'draggable', 'spellcheck'];
const ALIASES: Record<string, string> = { autoFocus: 'autofocus', contentEditable: 'contenteditable', htmlFor: 'for' };
const controlled = new WeakMap<Element, Fiber>();
const restoring = new WeakSet<Document>();

function patchProps(fiber: Fiber, next: Record<string, any>, appearance?: Appearance) {
  const element = fiber.start as Element;
  const previous = fiber.props!;
  const raw = 'dangerouslySetInnerHTML' in next;
  const resolved = appearance?.context?.resolve(next, fiber.type as string);

  if (raw) {
    for (let index = fiber.children.length - 1; index >= 0; index--)
      unmountFiber(fiber.children[index]);
    fiber.children = [];
  }

  for (const key of Object.keys({ ...previous, ...next })) {
    if (key.startsWith('_') || key == 'children' || key == 'className' || key == 'key' || key == 'ref' || key == 'style' || CONTROLS.includes(key)) continue;
    if (previous[key] === next[key]) continue;
    patchProp(fiber, element, key, previous[key], next[key]);
  }

  const claimed = claim(element, appearance, resolved, next.className, next.style);

  applyClaim(element, fiber.claimed, claimed);
  fiber.claimed = claimed;
  fiber.props = next;
  fiber.appearance = appearance;

  if (!raw) {
    reconcileChildren(
      fiber,
      element,
      null,
      next.children,
      fiber.context,
      fiber.boundary,
      claimed.context ? { context: claimed.context, entries: [] } : undefined
    );
  }

  for (const key of CONTROLS) {
    const value = next[key];
    const live = (element as any)[key];
    const differs = value == null || !(key in element)
      ? previous[key] !== value
      : key == 'value' ? String(live) !== String(value) : live !== value;

    if (differs) patchProp(fiber, element, key, previous[key], value);
  }

  if (CONTROLS.some((key) => next[key] != null)) {
    const document = element.ownerDocument;

    controlled.set(element, fiber);

    if (!restoring.has(document)) {
      restoring.add(document);
      document.addEventListener('input', restoreTarget);
      document.addEventListener('change', restoreTarget);
    }
  }

  if (previous.ref !== next.ref) patchProp(fiber, element, 'ref', previous.ref, next.ref);
}

function patchProp(fiber: Fiber, element: Element, key: string, previous: any, next: any) {
  if (key == 'ref') {
    applyRef(previous, null);
    inserted(fiber, () => applyRef(next, element));
    return;
  }

  if (key == 'dangerouslySetInnerHTML') {
    element.innerHTML = next?.__html || '';
    return;
  }

  if (/^on[A-Z]/.test(key)) {
    const capture = key.endsWith('Capture');
    const lower = (capture ? key.slice(2, -7) : key.slice(2)).toLowerCase();
    const name = lower == 'doubleclick' ? 'dblclick' : lower;
    const id = `${name}:${capture}`;
    const current = fiber.events!.get(id);

    if (current) element.removeEventListener(name, current, capture);
    if (typeof next == 'function') {
      fiber.events!.set(id, next);
      element.addEventListener(name, next, capture);
    } else fiber.events!.delete(id);
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
  const fiber = controlled.get(element);

  if (fiber && event.type == settles(fiber.props!, element))
    queueMicrotask(() => afterFlush(() => restore(fiber)));
}

function settles(props: Record<string, any>, element: HTMLInputElement) {
  if (props.onInput) return 'input';
  if (props.onChange) return 'change';
  return element.type == 'checkbox' || element.type == 'radio' || element.localName == 'select' ? 'change' : 'input';
}

function restore(fiber: Fiber) {
  const element = fiber.start as any;

  for (const key of CONTROLS) {
    const value = fiber.props![key];

    if (value == null || fiber.dead) continue;
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

function applyRef(ref: unknown, value: Element | null) {
  if (typeof ref == 'function') ref(value);
  else if (ref && typeof ref == 'object' && 'current' in ref) (ref as { current: Element | null }).current = value;
}

export { SVG, applyRef, patchProps };
