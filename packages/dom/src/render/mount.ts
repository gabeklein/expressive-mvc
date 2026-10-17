import { Component, Context, Model } from '@expressive/mvc';
import { Fragment } from '@expressive/mvc/jsx-runtime';

import { isVNode, PORTAL } from '../node/vnode';
import type { Node as RenderNode, VNode } from '../node/vnode';
import type { Appearance } from '../style/claim';
import { dispose } from './adapter';
import { isCollection, mountCollection } from './collection';
import { mountComponent, mountFunction, mountOwnedComponent, renderable, unmountComponent } from './component';
import { mountElement, unmountElement } from './element';
import { range, removeRange } from './fiber';
import type { Boundary, Fiber } from './fiber';
import { untrack } from './hot';
import { mountPortal, unmountPortal } from './portal';
import { reconcile } from './reconcile';
import { hold, unwait } from './suspense';

function complete<T extends Fiber>(fiber: T, work: () => void): T {
  try {
    work();
  } catch (error) {
    if (!hold(fiber, error)) unmountFiber(fiber);

    throw error;
  }

  return fiber;
}

function mount(value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance): Fiber {
  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'bigint') {
    const text = document.createTextNode(String(value));
    parent.insertBefore(text, before);
    return { kind: 'text', value, context, start: text, end: text, children: [] };
  }

  if (renderable(value)) return mountComponent(value, parent, before, context, boundary, appearance);
  if (value instanceof Model) notRenderable(value.constructor);
  if (isCollection(value))
    return mountCollection(value, parent, before, context, boundary, appearance);

  if (!isVNode(value)) throw new TypeError(`Cannot render ${String(value)}.`);

  if (value.type === Fragment) return mountFragment(value, parent, before, context, boundary, appearance);
  if (value.type === PORTAL) return mountPortal(value, parent, before, context, boundary, appearance);
  if (typeof value.type == 'string') return mountElement(value, parent, before, context, boundary, appearance);
  if (typeof value.type != 'function')
    throw new Error(`Cannot render ${String(value.type)}.`);

  if (value.type === Component || value.type.prototype instanceof Component)
    return mountOwnedComponent(value, parent, before, context, boundary, appearance);

  if (value.type.prototype instanceof Model) notRenderable(value.type);

  return mountFunction(value, parent, before, context, boundary, appearance);
}

function mountFragment(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('fragment', parent, before, context);
  fiber.key = value.key;
  fiber.type = Fragment;
  fiber.appearance = appearance;

  return complete(fiber, () => {
    reconcile(fiber, value.props.children, context, boundary, appearance);
  });
}

function patchText(fiber: Fiber, value: RenderNode) {
  const next = String(value);
  if (fiber.start.nodeValue !== next) fiber.start.nodeValue = next;
  fiber.value = value;
}

function patchFragment(fiber: Fiber, value: VNode, context: Context, appearance?: Appearance) {
  fiber.context = context;
  fiber.appearance = appearance;
  reconcile(fiber, value.props.children, context, fiber.boundary, appearance);
}

function unmountFiber(fiber: Fiber) {
  fiber.dead = true;
  unwait(fiber);

  for (let index = fiber.children.length - 1; index >= 0; index--)
    unmountFiber(fiber.children[index]);

  if (fiber.placeholder) unmountFiber(fiber.placeholder);

  fiber.suspended?.forEach((clear) => clear());
  if (fiber.kind == 'function') untrack(fiber.type as Function, fiber.scope!);
  if (fiber.scope) dispose(fiber.scope);
  fiber.release?.();

  if (fiber.kind == 'element') unmountElement(fiber);
  else if (fiber.kind == 'component') unmountComponent(fiber);
  else if (fiber.kind == 'portal') unmountPortal(fiber);

  removeRange(fiber.start, fiber.end);
}

function notRenderable(type: Function): never {
  throw new Error(`${type.name} is a Model - extend Component to render it, or provide it with <Component for={${type.name}}>.`);
}

export { complete, mount, patchFragment, patchText, unmountFiber };
