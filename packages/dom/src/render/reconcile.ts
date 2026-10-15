import { Component, Context, State } from '@expressive/mvc';
import { has, map } from '@expressive/mvc';

import { childrenOf, isVNode } from '../node/vnode';
import type { Key, Node as RenderNode, VNode } from '../node/vnode';
import { attach } from './commits';
import { patchProps } from './element';
import { park, move } from './fiber';
import type { Boundary, Renderable, Fiber, Appearance } from './fiber';
import { same, track, untrack } from './hot';
import { componentProps, mount, runFunction, runComponent, runCollection, unmountFiber } from './mount';
import { passiveRender } from './render';
import { claim as dequeue, settle as absorb } from './scheduler';
import { observe } from './style';
import { holding } from './suspense';

function reconcile(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const detached = fiber.stash || fiber.staging;

  if (detached) reconcileChildren(fiber, detached, null, value, context, boundary, appearance);
  else reconcileChildren(fiber, fiber.end.parentNode!, fiber.end, value, context, boundary, appearance);
}

function reconcilePortal(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  reconcileChildren(fiber, fiber.portalEnd!.parentNode!, fiber.portalEnd!, value, context, boundary, appearance);
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
    if (holding && error === holding.thrown) {
      for (const fiber of next) if (!old.includes(fiber)) park(fiber);
      if (holding.fiber) next.push(holding.fiber);
      holding.fiber = undefined;
    }

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
  if (old.kind == 'collection') {
    if (old.appearance !== appearance) {
      old.appearance = appearance;
      runCollection(old, passiveRender);
    }
    return old;
  }

  if (old.kind == 'text') {
    const next = String(value);
    if (old.start.nodeValue !== next) old.start.nodeValue = next;
    old.value = value;
  } else if (old.kind == 'element') {
    patchProps(old, (value as VNode).props, appearance);
  } else if (old.kind == 'fragment') {
    old.context = context;
    old.appearance = appearance;
    reconcile(old, (value as VNode).props.children, context, old.boundary, appearance);
  } else if (old.kind == 'function') {
    const vnode = value as VNode;
    const resolved = componentProps(vnode.type, vnode.props, appearance);
    if (old.type !== vnode.type) {
      untrack(old.type as Function, old.scope!);
      old.type = vnode.type;
      old.scope!.hot = true;
      track(old.type as Function, old.scope!);
    }
    old.appearance = resolved.appearance;
    old.props = observe(resolved.props);
    rerun(old, () => runFunction(old, passiveRender));
  } else if (old.kind == 'component') {
    const resolved = isVNode(value)
      ? componentProps(value.type, value.props, appearance)
      : { appearance, props: old.props! };
    old.appearance = resolved.appearance;
    const props = isVNode(value) ? observe(resolved.props) : resolved.props;
    if (isVNode(value) && props !== old.props) {
      const instance = old.instance!;
      if (passiveRender) old.applied = true;
      if (instance instanceof Component) (instance as any).props = props;
      else instance.set(merge(old.props!, props) as never);
    }
    old.props = props;
    rerun(old, () => runComponent(old, passiveRender));
  } else {
    old.appearance = appearance;
    const vnode = value as VNode;
    old.props = vnode.props;
    reconcilePortal(old, vnode.props.children, context, old.boundary, appearance);
  }

  return old;
}

function rerun(fiber: Fiber, run: () => void) {
  dequeue(fiber.scope!);
  run();
  absorb(fiber.scope!);
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
  if (value instanceof State) return value.is;

  while (isCollection(value) && isCollection(Object.getPrototypeOf(value)))
    value = Object.getPrototypeOf(value);

  return value;
}

function renderable(value: unknown): value is Renderable {
  return value instanceof State && typeof (value as Renderable).render == 'function';
}

function merge(previous: Record<string, any>, next: Record<string, any>) {
  const output: Record<string, any> = {};
  for (const key in previous) output[key] = undefined;
  return { ...output, ...next };
}

function isCollection(value: unknown): value is has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown> {
  return value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed;
}

function keyOf(value: RenderNode): Key {
  if (renderable(value)) return value.key;
  return isVNode(value) ? value.key : undefined;
}

export { isCollection, reconcile, reconcileChildren, reconcilePortal, renderable };
