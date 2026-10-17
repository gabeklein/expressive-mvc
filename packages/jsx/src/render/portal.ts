import { Context } from '@expressive/mvc';

import { PORTAL } from '../node/vnode';
import type { Node as RenderNode, VNode } from '../node/vnode';
import type { Appearance } from '../style/claim';
import type { Boundary, Fiber } from './fiber';
import { host } from './host';
import type { HostNode } from './host';
import { complete } from './mount';
import { reconcileChildren } from './reconcile';

function mountPortal(value: VNode, parent: HostNode, before: HostNode | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const marker = host.marker('portal');
  const container = host.target(value.props.into, parent);
  const portalStart = host.marker('portal-root');
  const portalEnd = host.marker('/portal-root');

  host.insert(parent, marker, before);
  host.insert(container, portalStart, null);
  host.insert(container, portalEnd, null);

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

function reconcilePortal(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  reconcileChildren(fiber, host.parent(fiber.portalEnd!)!, fiber.portalEnd!, value, context, boundary, appearance);
}

function patchPortal(fiber: Fiber, value: VNode, context: Context, appearance?: Appearance) {
  fiber.appearance = appearance;
  fiber.props = value.props;
  reconcilePortal(fiber, value.props.children, context, fiber.boundary, appearance);
}

function unmountPortal(fiber: Fiber) {
  host.remove(fiber.portalStart!);
  host.remove(fiber.portalEnd!);
}

export { mountPortal, patchPortal, unmountPortal };
