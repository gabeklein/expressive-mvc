import { Context } from '@expressive/mvc';

import { isVNode, PORTAL, vnode } from '../node/vnode';
import type { Node as RenderNode, VNode } from '../node/vnode';
import type { Appearance } from '../style/claim';
import type { Boundary, Container, Fiber } from './fiber';
import { adopt } from './hydrate';
import { hostOf } from './suspense';
import { complete } from './mount';
import { reconcileChildren } from './reconcile';

function mountPortal(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const marker = adopt(parent, before, () => document.createComment('portal'), (node) => node.nodeType == 8 && (node as Comment).data == 'portal');
  const container = target(value.props.into, parent);
  const portalStart = document.createComment('portal-root');
  const portalEnd = document.createComment('/portal-root');

  if (value.props[LEAD]) container.prepend(portalStart, portalEnd);
  else container.append(portalStart, portalEnd);

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

const HOISTED = new Set(['title', 'meta', 'link']);
const LEAD = Symbol('lead');

function hoist(value: RenderNode, parent: globalThis.Node): RenderNode {
  if (!isVNode(value) || typeof value.type != 'string' || !HOISTED.has(value.type)) return value;

  const { head } = parent.ownerDocument!;
  const host = hostOf(parent);

  if (head.contains(host) || host instanceof SVGElement && host.localName != 'foreignObject') return value;

  return vnode(PORTAL, { into: head, children: value, [LEAD]: value.type == 'title' }, value.key);
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

export { hoist, mountPortal, patchPortal, unmountPortal };
