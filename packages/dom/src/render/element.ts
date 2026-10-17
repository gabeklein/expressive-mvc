import { Context } from '@expressive/mvc';

import type { VNode } from '../node/vnode';
import { claim } from '../style/claim';
import type { Appearance } from '../style/claim';
import { inserted } from './commits';
import type { Boundary, Fiber } from './fiber';
import { host } from './host';
import type { HostNode } from './host';
import { complete, unmountFiber } from './mount';
import { reconcileChildren } from './reconcile';
import { hostOf } from './suspense';

const RESERVED = ['children', 'className', 'key', 'ref', 'style'];

function mountElement(value: VNode, parent: HostNode, before: HostNode | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const tag = value.type as string;
  const element = host.element(tag, hostOf(parent));
  const fiber: Fiber = {
    kind: 'element',
    key: value.key,
    type: tag,
    props: {},
    context,
    boundary,
    start: element,
    end: element,
    children: []
  };

  host.insert(parent, element, before);
  complete(fiber, () => {
    patchProps(fiber, value.props, appearance);
  });

  host.created?.(element, value.props);
  return fiber;
}

function patchProps(fiber: Fiber, next: Record<string, any>, appearance?: Appearance) {
  const element = fiber.start;
  const previous = fiber.props!;
  const raw = !!host.raw && host.raw in next;
  const resolved = appearance?.context?.resolve(next, fiber.type as string);

  if (raw) {
    for (let index = fiber.children.length - 1; index >= 0; index--)
      unmountFiber(fiber.children[index]);
    fiber.children = [];
  }

  for (const key of Object.keys({ ...previous, ...next })) {
    if (key.startsWith('_') || RESERVED.includes(key)) continue;
    if (previous[key] === next[key]) continue;
    host.prop(element, key, previous[key], next[key]);
  }

  const claimed = claim(appearance, resolved, next.className, next.style);

  host.style(element, fiber.claimed, claimed);
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

  host.settle?.(element, next, previous);

  if (previous.ref !== next.ref) {
    applyRef(previous.ref, null);
    inserted(fiber, () => applyRef(next.ref, element));
  }
}

function applyRef(ref: unknown, value: HostNode | null) {
  if (typeof ref == 'function') ref(value);
  else if (ref && typeof ref == 'object' && 'current' in ref) (ref as { current: HostNode | null }).current = value;
}

function unmountElement(fiber: Fiber) {
  applyRef(fiber.props?.ref, null);
  host.release?.(fiber.start);
}

export { mountElement, patchProps, unmountElement };
