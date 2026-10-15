import { Context } from '@expressive/mvc';

import { PORTAL } from '../node/vnode';
import type { Node as RenderNode, VNode } from '../node/vnode';
import type { Appearance } from '../style/claim';
import type { Boundary, Container, Fiber } from './fiber';
import { complete } from './mount';
import { reconcileChildren } from './reconcile';

function mountPortal(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const marker = document.createComment('portal');
  const container = target(value.props.into, parent);
  const portalStart = document.createComment('portal-root');
  const portalEnd = document.createComment('/portal-root');

  parent.insertBefore(marker, before);
  container.append(portalStart, portalEnd);

  const output: Fiber = {
    kind: 'portal',
    key: value.key,
    type: PORTAL,
    props: value.props,
    context,
    boundary,
    appearance,
    start: marker,
    end: marker,
    children: [],
    portalContainer: container,
    portalStart,
    portalEnd
  };

  return complete(output, () => {
    reconcilePortal(output, value.props.children, context, boundary, appearance);
  });
}

function target(into: unknown, parent: globalThis.Node): Container {
  if (typeof into != 'string') return into as Container;

  const root = parent.getRootNode();
  const found = [...document.querySelectorAll(into)];

  if (root instanceof DocumentFragment) found.push(...root.querySelectorAll(into));

  if (found.length != 1)
    throw new Error(`Portal target "${into}" ${found.length ? 'is ambiguous' : 'was not found'}.`);

  return found[0];
}

function reconcilePortal(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  reconcileChildren(fiber, fiber.portalEnd!.parentNode!, fiber.portalEnd!, value, context, boundary, appearance);
}

function patchPortal(fiber: Fiber, value: VNode, context: Context, appearance?: Appearance) {
  fiber.appearance = appearance;
  fiber.props = value.props;
  reconcilePortal(fiber, value.props.children, context, fiber.boundary, appearance);
}

function unmountPortal(fiber: Fiber) {
  (fiber.portalStart as ChildNode).remove();
  (fiber.portalEnd as ChildNode).remove();
}

export { mountPortal, patchPortal, unmountPortal };
