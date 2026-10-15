import { Context, Model } from '@expressive/mvc';

import { childrenOf, isVNode } from '../node/vnode';
import type { Key, Node as RenderNode, VNode } from '../node/vnode';
import type { Appearance } from '../style/claim';
import { isCollection, patchCollection } from './collection';
import { attach } from './commits';
import { patchComponent, patchFunction, renderable } from './component';
import { patchProps } from './element';
import { move } from './fiber';
import type { Boundary, Fiber } from './fiber';
import { same } from './hot';
import { mount, patchFragment, patchText, unmountFiber } from './mount';
import { patchPortal } from './portal';
import { gather } from './suspense';

function reconcile(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const detached = fiber.stash || fiber.staging;

  if (detached) reconcileChildren(fiber, detached, null, value, context, boundary, appearance);
  else reconcileChildren(fiber, fiber.end.parentNode!, fiber.end, value, context, boundary, appearance);
}

function reconcileChildren(owner: Fiber, parent: globalThis.Node, before: globalThis.Node | null, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const values = childrenOf(value);
  const old = owner.children;
  const keyed = new Map<Key, Fiber>();
  const used = new Set<Fiber>();
  const next: Fiber[] = [];

  for (const child of old)
    if (child.key !== null && child.key !== undefined) keyed.set(child.key, child);

  try {
    for (let index = 0; index < values.length; index++) {
      const value = source(values[index]);
      const key = keyOf(value);
      let child = key !== null && key !== undefined
        ? keyed.get(key)
        : old[index]?.key == null
          ? old[index]
          : undefined;

      if (child && used.has(child)) child = undefined;
      if (child) used.add(child);

      const fiber = patch(child, value, parent, before, context, boundary, appearance);

      if (fiber !== child) used.delete(child!);
      next.push(fiber);
    }
  } catch (error) {
    gather(error, next, old);
    owner.children = [...next, ...old.filter((child) => !child.dead && !next.includes(child))];
    throw error;
  }

  for (const child of old)
    if (!used.has(child)) unmountFiber(child);

  let anchor = before;
  for (let index = next.length - 1; index >= 0; index--) {
    const child = next[index];
    const root = child.start.getRootNode();

    move(child, parent, anchor);
    anchor = child.start;
    if (child.start.getRootNode() !== root) attach(root);
  }

  owner.children = next;
}

function patch(old: Fiber | undefined, value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance): Fiber {
  if (!old || !compatible(old, value)) return mount(value, parent, old?.start || before, context, boundary, appearance);

  if (old.ownBoundary) old.ownBoundary.parent = boundary;
  old.boundary = old.ownBoundary || boundary;

  if (old.kind == 'collection') patchCollection(old, appearance);
  else if (old.kind == 'text') patchText(old, value);
  else if (old.kind == 'element') patchProps(old, (value as VNode).props, appearance);
  else if (old.kind == 'fragment') patchFragment(old, value as VNode, context, appearance);
  else if (old.kind == 'function') patchFunction(old, value as VNode, appearance);
  else if (old.kind == 'component') patchComponent(old, value, appearance);
  else patchPortal(old, value as VNode, context, appearance);

  return old;
}

function compatible(fiber: Fiber, value: RenderNode) {
  if (fiber.kind == 'text') return ['string', 'number', 'bigint'].includes(typeof value);
  if (renderable(value)) return fiber.kind == 'component' && fiber.instance === value;
  if (isCollection(value))
    return fiber.kind == 'collection' && fiber.source === value;
  if (!isVNode(value)) return false;
  if (fiber.key !== value.key || !same(fiber.type, value.type)) return false;
  if (fiber.kind == 'portal') return fiber.props!.into === value.props.into;
  return true;
}

function source(value: RenderNode): RenderNode {
  if (value instanceof Model) return value.is;

  while (isCollection(value) && isCollection(Object.getPrototypeOf(value)))
    value = Object.getPrototypeOf(value);

  return value;
}

function keyOf(value: RenderNode): Key {
  if (renderable(value)) return value.key;
  return isVNode(value) ? value.key : undefined;
}

export { reconcile, reconcileChildren };
